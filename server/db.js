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
    subject TEXT
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    class_id INTEGER,
    phone TEXT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    remark TEXT DEFAULT '',
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );
`);

// Seed default data if empty
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin').get().count;
if (adminCount === 0) {
  db.prepare('INSERT INTO admin (name, email, password) VALUES (?, ?, ?)').run(
    'Admin User', 'phirom007kh@gmail.com', hashPassword('nha061106')
  );
}

const teacherCount = db.prepare('SELECT COUNT(*) as count FROM teachers').get().count;
if (teacherCount === 0) {
  const insertTeacher = db.prepare('INSERT INTO teachers (id, name, email, password, subject) VALUES (?, ?, ?, ?, ?)');
  insertTeacher.run(1, 'Sarah Johnson', 'teacher@school.com', hashPassword('teach123'), 'Mathematics');
  insertTeacher.run(2, 'Mike Chen', 'mike@school.com', hashPassword('teach456'), 'Science');
}

const classCount = db.prepare('SELECT COUNT(*) as count FROM classes').get().count;
if (classCount === 0) {
  const insertClass = db.prepare('INSERT INTO classes (id, name, teacher_id) VALUES (?, ?, ?)');
  insertClass.run(1, 'Grade 10-A', 1);
  insertClass.run(2, 'Grade 10-B', 2);
  insertClass.run(3, 'Grade 11-A', 1);
}

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

const attCount = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
if (attCount === 0) {
  const insertAtt = db.prepare('INSERT INTO attendance (id, student_id, class_id, date, status, remark) VALUES (?, ?, ?, ?, ?, ?)');
  insertAtt.run(1, 1, 1, '2025-06-01', 'present', '');
  insertAtt.run(2, 2, 1, '2025-06-01', 'absent', 'Sick');
  insertAtt.run(3, 3, 1, '2025-06-01', 'present', '');
  insertAtt.run(4, 1, 1, '2025-06-02', 'late', 'Traffic');
  insertAtt.run(5, 2, 1, '2025-06-02', 'present', '');
  insertAtt.run(6, 3, 1, '2025-06-02', 'excused', 'Doctor');
  insertAtt.run(7, 4, 2, '2025-06-01', 'present', '');
  insertAtt.run(8, 5, 2, '2025-06-01', 'present', '');
}

migratePlainPasswords();

module.exports = db;
module.exports.hashPassword = hashPassword;
module.exports.isHashedPassword = isHashedPassword;

