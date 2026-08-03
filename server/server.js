const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, CSS, JS, Images)
app.use(express.static(path.join(__dirname, '../')));

// Default root route opens attendance_system.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../attendance_system.html'));
});

console.log('SQLite Database connected and ready.');

// -------------------------------------------------------------
//  FULL DB DUMP & SYNC API
// -------------------------------------------------------------
app.get('/api/db/all', (req, res) => {
  try {
    const classes = db.prepare('SELECT * FROM classes').all();
    const teachers = db.prepare('SELECT * FROM teachers').all();
    const students = db.prepare('SELECT * FROM students').all();
    const attendance = db.prepare('SELECT * FROM attendance').all();
    const admin = db.prepare('SELECT * FROM admin LIMIT 1').get();
    res.json({ classes, teachers, students, attendance, admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  AUTHENTICATION
// -------------------------------------------------------------
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;
  try {
    if (role === 'admin') {
      const admin = db.prepare('SELECT * FROM admin WHERE email = ? AND password = ?').get(email, password);
      if (admin) return res.json({ success: true, user: { ...admin, role: 'admin' } });
    } else if (role === 'teacher') {
      const teacher = db.prepare('SELECT * FROM teachers WHERE email = ? AND password = ?').get(email, password);
      if (teacher) return res.json({ success: true, user: { ...teacher, role: 'teacher' } });
    } else if (role === 'student') {
      const student = db.prepare('SELECT * FROM students WHERE email = ? AND password = ?').get(email, password);
      if (student) return res.json({ success: true, user: { ...student, role: 'student' } });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials or role' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  CLASSES
// -------------------------------------------------------------
app.get('/api/classes', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM classes').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/classes', (req, res) => {
  const { name, teacher_id } = req.body;
  try {
    const info = db.prepare('INSERT INTO classes (name, teacher_id) VALUES (?, ?)').run(name, teacher_id || null);
    res.json({ id: info.lastInsertRowid, name, teacher_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/classes/:id', (req, res) => {
  const { id } = req.params;
  const { name, teacher_id } = req.body;
  try {
    db.prepare('UPDATE classes SET name = ?, teacher_id = ? WHERE id = ?').run(name, teacher_id || null, id);
    res.json({ id: Number(id), name, teacher_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/classes/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM classes WHERE id = ?').run(id);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  TEACHERS
// -------------------------------------------------------------
app.get('/api/teachers', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM teachers').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teachers', (req, res) => {
  const { name, email, password, subject } = req.body;
  try {
    const info = db.prepare(
      'INSERT INTO teachers (name, email, password, subject) VALUES (?, ?, ?, ?)'
    ).run(name, email, password, subject || '');
    res.json({ id: info.lastInsertRowid, name, email, password, subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teachers/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, password, subject } = req.body;
  try {
    db.prepare(
      'UPDATE teachers SET name = ?, email = ?, password = ?, subject = ? WHERE id = ?'
    ).run(name, email, password, subject || '', id);
    res.json({ id: Number(id), name, email, password, subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teachers/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  STUDENTS
// -------------------------------------------------------------
app.get('/api/students', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM students').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', (req, res) => {
  const { name, email, password, class_id, phone } = req.body;
  try {
    const info = db.prepare(
      'INSERT INTO students (name, email, password, class_id, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, password, class_id || null, phone || '');
    res.json({ id: info.lastInsertRowid, name, email, password, class_id, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, password, class_id, phone } = req.body;
  try {
    db.prepare(
      'UPDATE students SET name = ?, email = ?, password = ?, class_id = ?, phone = ? WHERE id = ?'
    ).run(name, email, password, class_id || null, phone || '', id);
    res.json({ id: Number(id), name, email, password, class_id, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM students WHERE id = ?').run(id);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
//  ATTENDANCE
// -------------------------------------------------------------
app.get('/api/attendance', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM attendance').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', (req, res) => {
  const { student_id, class_id, date, status, remark } = req.body;
  try {
    const existing = db.prepare(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ?'
    ).get(student_id, date);

    if (existing) {
      db.prepare(
        'UPDATE attendance SET status = ?, remark = ?, class_id = ? WHERE id = ?'
      ).run(status, remark || '', class_id, existing.id);
      res.json({ id: existing.id, student_id, class_id, date, status, remark });
    } else {
      const info = db.prepare(
        'INSERT INTO attendance (student_id, class_id, date, status, remark) VALUES (?, ?, ?, ?, ?)'
      ).run(student_id, class_id, date, status, remark || '');
      res.json({ id: info.lastInsertRowid, student_id, class_id, date, status, remark });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk sync endpoint for array updates
app.post('/api/sync/:key', (req, res) => {
  const { key } = req.params;
  const items = req.body;
  try {
    const syncTransaction = db.transaction(() => {
      if (key === 'classes') {
        db.prepare('DELETE FROM classes').run();
        const insert = db.prepare('INSERT INTO classes (id, name, teacher_id) VALUES (?, ?, ?)');
        for (const item of items) insert.run(item.id, item.name, item.teacher_id || null);
      } else if (key === 'teachers') {
        db.prepare('DELETE FROM teachers').run();
        const insert = db.prepare('INSERT INTO teachers (id, name, email, password, subject) VALUES (?, ?, ?, ?, ?)');
        for (const item of items) insert.run(item.id, item.name, item.email, item.password, item.subject || '');
      } else if (key === 'students') {
        db.prepare('DELETE FROM students').run();
        const insert = db.prepare('INSERT INTO students (id, name, email, password, class_id, phone) VALUES (?, ?, ?, ?, ?, ?)');
        for (const item of items) insert.run(item.id, item.name, item.email, item.password, item.class_id || null, item.phone || '');
      } else if (key === 'attendance') {
        db.prepare('DELETE FROM attendance').run();
        const insert = db.prepare('INSERT INTO attendance (id, student_id, class_id, date, status, remark) VALUES (?, ?, ?, ?, ?, ?)');
        for (const item of items) insert.run(item.id, item.student_id, item.class_id, item.date, item.status, item.remark || '');
      }
    });

    syncTransaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
