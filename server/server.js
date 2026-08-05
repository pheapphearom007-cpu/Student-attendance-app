require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'attendtrack_super_secret_jwt_key_production_2026';
const PORT = process.env.PORT || 5000;

const app = express();

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  message: { success: false, message: 'Too many login or password recovery attempts. Please try again after 15 minutes.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many API requests from this IP. Please try again later.' }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', apiLimiter);

// -------------------------------------------------------------
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// -------------------------------------------------------------
function comparePassword(inputPassword, storedPassword) {
  if (!storedPassword || !inputPassword) return false;
  if (typeof storedPassword === 'string' && /^\$2[aby]\$/.test(storedPassword)) {
    return bcrypt.compareSync(inputPassword, storedPassword);
  }
  return false;
}

function ensureHashed(pwd) {
  if (!pwd) return db.hashPassword('123456');
  if (db.isHashedPassword(pwd)) return pwd;
  return db.hashPassword(pwd);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.token;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Access denied. No authorization token provided.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access forbidden. Insufficient permissions.' });
    }
    next();
  };
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../')));

app.get('/', (req, res) => {
  const publicPath = path.join(__dirname, 'public', 'attendance_system.html');
  const rootPath = path.join(__dirname, '../attendance_system.html');
  if (fs.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else {
    res.sendFile(rootPath);
  }
});

// -------------------------------------------------------------
//  PUBLIC AUTH & RECOVERY API
// -------------------------------------------------------------
app.post('/api/login', authLimiter, (req, res) => {
  const { email, password, role } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  try {
    let user = null;
    let foundRole = role || 'admin';

    if (foundRole === 'admin') {
      user = db.prepare('SELECT * FROM admin WHERE LOWER(email) = ?').get(cleanEmail);
    } else if (foundRole === 'teacher') {
      user = db.prepare('SELECT * FROM teachers WHERE LOWER(email) = ? AND is_deleted = 0').get(cleanEmail);
    } else if (foundRole === 'student') {
      user = db.prepare('SELECT * FROM students WHERE LOWER(email) = ? AND is_deleted = 0').get(cleanEmail);
    }

    if (user && comparePassword(cleanPassword, user.password)) {
      const sanitizedUser = { id: user.id, name: user.name, email: user.email, role: foundRole };
      if (user.subject) sanitizedUser.subject = user.subject;
      if (user.class_id) sanitizedUser.class_id = user.class_id;

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: foundRole },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      db.logAudit(user.id, foundRole, 'LOGIN_SUCCESS', foundRole, user.id, { email: cleanEmail });

      return res.json({
        success: true,
        token,
        user: sanitizedUser
      });
    }

    db.logAudit(null, role || 'unknown', 'LOGIN_FAILED', null, null, { email: cleanEmail });
    return res.status(401).json({ success: false, message: 'Invalid email, password, or role.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/recover-password', authLimiter, (req, res) => {
  const { email, newPassword, role } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Email and valid new password (min 6 chars) required.' });
  }

  try {
    const hashed = ensureHashed(newPassword);
    let targetTable = role === 'admin' ? 'admin' : (role === 'teacher' ? 'teachers' : 'students');
    const existing = db.prepare(`SELECT id FROM ${targetTable} WHERE LOWER(email) = ? AND (is_deleted IS NULL OR is_deleted = 0)`).get(cleanEmail);

    if (!existing) {
      return res.status(404).json({ success: false, message: `No registered ${role} account found with that email.` });
    }

    db.prepare(`UPDATE ${targetTable} SET password = ? WHERE id = ?`).run(hashed, existing.id);
    db.logAudit(existing.id, role, 'PASSWORD_RECOVERED', targetTable, existing.id, { email: cleanEmail });

    return res.json({ success: true, message: 'Password has been successfully updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    let user = null;
    if (req.user.role === 'admin') {
      user = db.prepare('SELECT id, name, email FROM admin WHERE id = ?').get(req.user.id);
    } else if (req.user.role === 'teacher') {
      user = db.prepare('SELECT id, name, email, subject FROM teachers WHERE id = ? AND is_deleted = 0').get(req.user.id);
    } else if (req.user.role === 'student') {
      user = db.prepare('SELECT id, name, email, class_id, phone FROM students WHERE id = ? AND is_deleted = 0').get(req.user.id);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account no longer exists.' });
    }

    return res.json({ success: true, user: { ...user, role: req.user.role } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', database: 'sqlite', timestamp: new Date().toISOString() });
});

// -------------------------------------------------------------
//  FULL DB FETCH FOR APP INIT (PROTECTED)
// -------------------------------------------------------------
app.get('/api/db/all', authenticateToken, (req, res) => {
  try {
    let classes, teachers, students, attendance;

    if (req.user.role === 'admin') {
      classes = db.prepare('SELECT id, name, teacher_id FROM classes WHERE is_deleted = 0').all();
      teachers = db.prepare('SELECT id, name, email, subject FROM teachers WHERE is_deleted = 0').all();
      students = db.prepare('SELECT id, name, email, class_id, phone FROM students WHERE is_deleted = 0').all();
      attendance = db.prepare('SELECT id, student_id, class_id, date, status, remark FROM attendance WHERE is_deleted = 0').all();
    } else if (req.user.role === 'teacher') {
      classes = db.prepare('SELECT id, name, teacher_id FROM classes WHERE teacher_id = ? AND is_deleted = 0').all(req.user.id);
      const classIds = classes.map(c => c.id);
      teachers = db.prepare('SELECT id, name, email, subject FROM teachers WHERE id = ? AND is_deleted = 0').all(req.user.id);
      if (classIds.length > 0) {
        const placeholders = classIds.map(() => '?').join(',');
        students = db.prepare(`SELECT id, name, email, class_id, phone FROM students WHERE class_id IN (${placeholders}) AND is_deleted = 0`).all(...classIds);
        attendance = db.prepare(`SELECT id, student_id, class_id, date, status, remark FROM attendance WHERE class_id IN (${placeholders}) AND is_deleted = 0`).all(...classIds);
      } else {
        students = [];
        attendance = [];
      }
    } else {
      students = db.prepare('SELECT id, name, email, class_id, phone FROM students WHERE id = ? AND is_deleted = 0').all(req.user.id);
      const student = students[0];
      classes = student ? db.prepare('SELECT id, name, teacher_id FROM classes WHERE id = ? AND is_deleted = 0').all(student.class_id) : [];
      teachers = [];
      attendance = db.prepare('SELECT id, student_id, class_id, date, status, remark FROM attendance WHERE student_id = ? AND is_deleted = 0').all(req.user.id);
    }

    const admin = db.prepare('SELECT id, name, email FROM admin LIMIT 1').get();
    res.json({ classes, teachers, students, attendance, admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  CLASSES ENDPOINTS
// -------------------------------------------------------------
app.get('/api/classes', authenticateToken, (req, res) => {
  try {
    let rows;
    if (req.user.role === 'teacher') {
      rows = db.prepare('SELECT id, name, teacher_id FROM classes WHERE teacher_id = ? AND is_deleted = 0').all(req.user.id);
    } else {
      rows = db.prepare('SELECT id, name, teacher_id FROM classes WHERE is_deleted = 0').all();
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/classes', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, teacher_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Class name is required.' });
  try {
    const info = db.prepare('INSERT INTO classes (name, teacher_id, is_deleted) VALUES (?, ?, 0)').run(name, teacher_id || null);
    db.logAudit(req.user.id, req.user.role, 'CREATE_CLASS', 'classes', info.lastInsertRowid, { name, teacher_id });
    res.json({ id: info.lastInsertRowid, name, teacher_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/classes/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, teacher_id } = req.body;
  try {
    db.prepare('UPDATE classes SET name = ?, teacher_id = ? WHERE id = ?').run(name, teacher_id || null, id);
    db.logAudit(req.user.id, req.user.role, 'UPDATE_CLASS', 'classes', Number(id), { name, teacher_id });
    res.json({ id: Number(id), name, teacher_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/classes/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('UPDATE classes SET is_deleted = 1 WHERE id = ?').run(id);
    db.logAudit(req.user.id, req.user.role, 'SOFT_DELETE_CLASS', 'classes', Number(id), {});
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  TEACHERS ENDPOINTS
// -------------------------------------------------------------
app.get('/api/teachers', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, email, subject FROM teachers WHERE is_deleted = 0').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teachers', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, email, password, subject } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!name || !cleanEmail) return res.status(400).json({ error: 'Name and email are required.' });
  const hashedPassword = ensureHashed(password);
  try {
    const info = db.prepare(
      'INSERT INTO teachers (name, email, password, subject, is_deleted) VALUES (?, ?, ?, ?, 0)'
    ).run(name, cleanEmail, hashedPassword, subject || '');
    db.logAudit(req.user.id, req.user.role, 'CREATE_TEACHER', 'teachers', info.lastInsertRowid, { name, email: cleanEmail });
    res.json({ id: info.lastInsertRowid, name, email: cleanEmail, subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teachers/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, email, password, subject } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  try {
    const existing = db.prepare('SELECT password FROM teachers WHERE id = ?').get(id);
    const hashedPassword = password ? ensureHashed(password) : (existing ? existing.password : ensureHashed('123456'));
    db.prepare(
      'UPDATE teachers SET name = ?, email = ?, password = ?, subject = ? WHERE id = ?'
    ).run(name, cleanEmail, hashedPassword, subject || '', id);
    db.logAudit(req.user.id, req.user.role, 'UPDATE_TEACHER', 'teachers', Number(id), { name, email: cleanEmail });
    res.json({ id: Number(id), name, email: cleanEmail, subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teachers/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('UPDATE teachers SET is_deleted = 1 WHERE id = ?').run(id);
    db.logAudit(req.user.id, req.user.role, 'SOFT_DELETE_TEACHER', 'teachers', Number(id), {});
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  STUDENTS ENDPOINTS
// -------------------------------------------------------------
app.get('/api/students', authenticateToken, (req, res) => {
  try {
    let rows;
    if (req.user.role === 'teacher') {
      const assignedClasses = db.prepare('SELECT id FROM classes WHERE teacher_id = ? AND is_deleted = 0').all(req.user.id);
      const classIds = assignedClasses.map(c => c.id);
      if (classIds.length === 0) return res.json([]);
      const placeholders = classIds.map(() => '?').join(',');
      rows = db.prepare(`SELECT id, name, email, class_id, phone FROM students WHERE class_id IN (${placeholders}) AND is_deleted = 0`).all(...classIds);
    } else if (req.user.role === 'student') {
      rows = db.prepare('SELECT id, name, email, class_id, phone FROM students WHERE id = ? AND is_deleted = 0').all(req.user.id);
    } else {
      rows = db.prepare('SELECT id, name, email, class_id, phone FROM students WHERE is_deleted = 0').all();
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, email, password, class_id, phone } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!name || !cleanEmail) return res.status(400).json({ error: 'Name and email are required.' });
  const hashedPassword = ensureHashed(password);
  try {
    const info = db.prepare(
      'INSERT INTO students (name, email, password, class_id, phone, is_deleted) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(name, cleanEmail, hashedPassword, class_id || null, phone || '');
    db.logAudit(req.user.id, req.user.role, 'CREATE_STUDENT', 'students', info.lastInsertRowid, { name, email: cleanEmail });
    res.json({ id: info.lastInsertRowid, name, email: cleanEmail, class_id, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', authenticateToken, requireRole('admin', 'teacher'), (req, res) => {
  const { id } = req.params;
  const { name, email, password, class_id, phone } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  try {
    const existing = db.prepare('SELECT password FROM students WHERE id = ?').get(id);
    const hashedPassword = password ? ensureHashed(password) : (existing ? existing.password : ensureHashed('123456'));
    db.prepare(
      'UPDATE students SET name = ?, email = ?, password = ?, class_id = ?, phone = ? WHERE id = ?'
    ).run(name, cleanEmail, hashedPassword, class_id || null, phone || '', id);
    db.logAudit(req.user.id, req.user.role, 'UPDATE_STUDENT', 'students', Number(id), { name, email: cleanEmail });
    res.json({ id: Number(id), name, email: cleanEmail, class_id, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('UPDATE students SET is_deleted = 1 WHERE id = ?').run(id);
    db.logAudit(req.user.id, req.user.role, 'SOFT_DELETE_STUDENT', 'students', Number(id), {});
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  ATTENDANCE ENDPOINTS (WITH BULK ATOMIC TRANSACTIONS)
// -------------------------------------------------------------
app.get('/api/attendance', authenticateToken, (req, res) => {
  try {
    let rows;
    if (req.user.role === 'teacher') {
      const assignedClasses = db.prepare('SELECT id FROM classes WHERE teacher_id = ? AND is_deleted = 0').all(req.user.id);
      const classIds = assignedClasses.map(c => c.id);
      if (classIds.length === 0) return res.json([]);
      const placeholders = classIds.map(() => '?').join(',');
      rows = db.prepare(`SELECT id, student_id, class_id, date, status, remark FROM attendance WHERE class_id IN (${placeholders}) AND is_deleted = 0`).all(...classIds);
    } else if (req.user.role === 'student') {
      rows = db.prepare('SELECT id, student_id, class_id, date, status, remark FROM attendance WHERE student_id = ? AND is_deleted = 0').all(req.user.id);
    } else {
      rows = db.prepare('SELECT id, student_id, class_id, date, status, remark FROM attendance WHERE is_deleted = 0').all();
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', authenticateToken, requireRole('admin', 'teacher'), (req, res) => {
  const { student_id, class_id, date, status, remark } = req.body;
  if (!student_id || !class_id || !date || !status) {
    return res.status(400).json({ error: 'Missing required attendance fields.' });
  }

  try {
    const existing = db.prepare(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND is_deleted = 0'
    ).get(student_id, date);

    if (existing) {
      db.prepare(
        'UPDATE attendance SET status = ?, remark = ?, class_id = ? WHERE id = ?'
      ).run(status, remark || '', class_id, existing.id);
      db.logAudit(req.user.id, req.user.role, 'UPDATE_ATTENDANCE', 'attendance', existing.id, { student_id, status });
      res.json({ id: existing.id, student_id, class_id, date, status, remark });
    } else {
      const info = db.prepare(
        'INSERT INTO attendance (student_id, class_id, date, status, remark, is_deleted) VALUES (?, ?, ?, ?, ?, 0)'
      ).run(student_id, class_id, date, status, remark || '');
      db.logAudit(req.user.id, req.user.role, 'CREATE_ATTENDANCE', 'attendance', info.lastInsertRowid, { student_id, status });
      res.json({ id: info.lastInsertRowid, student_id, class_id, date, status, remark });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/bulk', authenticateToken, requireRole('admin', 'teacher'), (req, res) => {
  const records = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Array of attendance records required.' });
  }

  try {
    const processBulk = db.transaction((items) => {
      const findExisting = db.prepare('SELECT id FROM attendance WHERE student_id = ? AND date = ? AND is_deleted = 0');
      const updateAtt = db.prepare('UPDATE attendance SET status = ?, remark = ?, class_id = ? WHERE id = ?');
      const insertAtt = db.prepare('INSERT INTO attendance (student_id, class_id, date, status, remark, is_deleted) VALUES (?, ?, ?, ?, ?, 0)');

      for (const item of items) {
        const existing = findExisting.get(item.student_id, item.date);
        if (existing) {
          updateAtt.run(item.status, item.remark || '', item.class_id, existing.id);
        } else {
          insertAtt.run(item.student_id, item.class_id, item.date, item.status, item.remark || '');
        }
      }
    });

    processBulk(records);
    db.logAudit(req.user.id, req.user.role, 'BULK_ATTENDANCE_RECORDED', 'attendance', null, { count: records.length });
    res.json({ success: true, count: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  ACADEMIC TERMS & AUDIT LOGS ENDPOINTS
// -------------------------------------------------------------
app.get('/api/academic-years', authenticateToken, (req, res) => {
  try {
    const years = db.prepare('SELECT * FROM academic_years ORDER BY id DESC').all();
    const semesters = db.prepare('SELECT * FROM semesters ORDER BY id ASC').all();
    res.json({ academic_years: years, semesters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit-logs', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  CSV EXPORT ENDPOINTS (PROTECTED)
// -------------------------------------------------------------
app.get('/api/export/attendance.csv', authenticateToken, (req, res) => {
  try {
    const attendance = db.prepare('SELECT * FROM attendance WHERE is_deleted = 0').all();
    const students = db.prepare('SELECT id, name, email FROM students').all();
    const classes = db.prepare('SELECT id, name FROM classes').all();

    let csv = 'ID,Student Name,Student Email,Class,Date,Status,Remark\n';
    attendance.forEach(a => {
      const s = students.find(x => x.id === a.student_id) || { name: 'Unknown', email: '' };
      const c = classes.find(x => x.id === a.class_id) || { name: 'Unknown' };
      csv += `"${a.id}","${s.name}","${s.email}","${c.name}","${a.date}","${a.status}","${a.remark || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_records.csv"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/students.csv', authenticateToken, (req, res) => {
  try {
    const students = db.prepare('SELECT id, name, email, class_id, phone FROM students WHERE is_deleted = 0').all();
    const classes = db.prepare('SELECT id, name FROM classes').all();

    let csv = 'ID,Name,Email,Class,Phone\n';
    students.forEach(s => {
      const c = classes.find(x => x.id === s.class_id) || { name: 'Unassigned' };
      csv += `"${s.id}","${s.name}","${s.email}","${c.name}","${s.phone || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students_list.csv"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/teachers.csv', authenticateToken, (req, res) => {
  try {
    const teachers = db.prepare('SELECT id, name, email, subject FROM teachers WHERE is_deleted = 0').all();

    let csv = 'ID,Name,Email,Subject\n';
    teachers.forEach(t => {
      csv += `"${t.id}","${t.name}","${t.email}","${t.subject || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="teachers_list.csv"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
