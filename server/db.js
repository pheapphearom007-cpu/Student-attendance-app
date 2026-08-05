const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'attendance.db'));

function isHashedPassword(value) {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function migratePlainPasswords() {
  ['admin', 'teachers', 'students'].forEach((table) => {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    rows.forEach((row) => {
      if (row.password && !isHashedPassword(row.password)) {
        const hashed = hashPassword(row.password);
        db.prepare(`UPDATE ${table} SET password = ? WHERE id = ?`).run(hashed, row.id);
      }
    });
  });
}

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    subject TEXT,
    is_deleted INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    class_id INTEGER,
    phone TEXT,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    remark TEXT DEFAULT '',
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS academic_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS semesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_year_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user_id INTEGER,
    user_role TEXT,
    action TEXT NOT NULL,
    target_table TEXT,
    record_id INTEGER,
    details TEXT
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    val TEXT
  );
`);

// Add is_deleted column to existing databases if missing
function ensureColumnExists(table, column, typeDef) {
  try {
    const pragma = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = pragma.some(col => col.name === column);
    if (!exists) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`).run();
    }
  } catch (err) {
    console.warn(`Column migration check warning for ${table}.${column}:`, err.message);
  }
}

['teachers', 'classes', 'students', 'attendance'].forEach(t => ensureColumnExists(t, 'is_deleted', 'INTEGER DEFAULT 0'));

// One-Time Initial Seeding Check
const isSeeded = db.prepare('SELECT val FROM system_settings WHERE key = ?').get('is_initial_seeded');

if (!isSeeded) {
  // Seed default Admin if empty
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin').get().count;
  if (adminCount === 0) {
    db.prepare('INSERT INTO admin (name, email, password) VALUES (?, ?, ?)').run(
      'Admin User', 'phirom007kh@gmail.com', hashPassword('nha061106')
    );
  }

  // Seed default Teachers if empty
  const teacherCount = db.prepare('SELECT COUNT(*) as count FROM teachers').get().count;
  if (teacherCount === 0) {
    const insertTeacher = db.prepare('INSERT INTO teachers (id, name, email, password, subject) VALUES (?, ?, ?, ?, ?)');
    insertTeacher.run(1, 'Sarah Johnson', 'teacher@school.com', hashPassword('teach123'), 'Mathematics');
    insertTeacher.run(2, 'Mike Chen', 'mike@school.com', hashPassword('teach456'), 'Science');
  }

  // Seed default Classes if empty
  const classCount = db.prepare('SELECT COUNT(*) as count FROM classes').get().count;
  if (classCount === 0) {
    const insertClass = db.prepare('INSERT INTO classes (id, name, teacher_id) VALUES (?, ?, ?)');
    insertClass.run(1, 'Grade 10-A', 1);
    insertClass.run(2, 'Grade 10-B', 2);
    insertClass.run(3, 'Grade 11-A', 1);
  }

  // Seed default Students if empty
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  if (studentCount === 0) {
    const insertStudent = db.prepare('INSERT INTO students (id, name, email, password, class_id, phone) VALUES (?, ?, ?, ?, ?, ?)');
    insertStudent.run(1, 'Alice Smith', 'student@school.com', hashPassword('stu123'), 1, '012-345-6789');
    insertStudent.run(2, 'Bob Lee', 'bob@school.com', hashPassword('stu456'), 1, '012-345-6790');
    insertStudent.run(3, 'Carol White', 'carol@school.com', hashPassword('stu789'), 1, '012-345-6791');
    insertStudent.run(4, 'David Brown', 'david@school.com', hashPassword('stu000'), 2, '012-345-6792');
    insertStudent.run(5, 'Eva Green', 'eva@school.com', hashPassword('stu001'), 2, '012-345-6793');
    insertStudent.run(6, 'Frank Kim', 'frank@school.com', hashPassword('stu002'), 3, '012-345-6794');
  }

  // Clear legacy sample attendance records so attendance starts at 0 until teachers submit real data
  db.prepare('DELETE FROM attendance').run();

  // Seed Academic Years if empty
  const ayCount = db.prepare('SELECT COUNT(*) as count FROM academic_years').get().count;
  if (ayCount === 0) {
    const insertAY = db.prepare('INSERT INTO academic_years (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)');
    insertAY.run(1, '2025-2026 Academic Year', '2025-09-01', '2026-06-30', 1);

    const insertSem = db.prepare('INSERT INTO semesters (id, academic_year_id, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)');
    insertSem.run(1, 1, 'Semester 1 (Fall)', '2025-09-01', '2026-01-31');
    insertSem.run(2, 1, 'Semester 2 (Spring)', '2026-02-01', '2026-06-30');
  }

  // Mark database as initialized so seeding never runs again
  db.prepare('INSERT OR REPLACE INTO system_settings (key, val) VALUES (?, ?)').run('is_initial_seeded', '1');
}

// Ensure Admin account exists if no admin accounts exist
const ensureAdmin = db.prepare('SELECT COUNT(*) as count FROM admin').get().count;
if (ensureAdmin === 0) {
  db.prepare('INSERT INTO admin (name, email, password) VALUES (?, ?, ?)').run(
    'Admin User', 'phirom007kh@gmail.com', hashPassword('nha061106')
  );
}

migratePlainPasswords();

function logAudit(userId, userRole, action, targetTable, recordId, details) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (timestamp, user_id, user_role, action, target_table, record_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      userId || null,
      userRole || 'anonymous',
      action,
      targetTable || null,
      recordId || null,
      typeof details === 'object' ? JSON.stringify(details) : (details || '')
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = db;
module.exports.hashPassword = hashPassword;
module.exports.isHashedPassword = isHashedPassword;
module.exports.logAudit = logAudit;


