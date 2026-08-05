process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_jest_unit_tests';

const request = require('supertest');
const app = require('../server');
const db = require('../db');

describe('AttendTrack API & Security Test Suite', () => {
  let adminToken;
  let teacherToken;
  let studentToken;

  test('1. Public Health Check Endpoint', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.database).toEqual('sqlite');
  });

  test('2. Authentication - Admin Login', async () => {
    const res = await request(app).post('/api/login').send({
      email: 'phirom007kh@gmail.com',
      password: 'nha061106',
      role: 'admin'
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toEqual('admin');
    adminToken = res.body.token;
  });

  test('3. Authentication - Teacher Login', async () => {
    const res = await request(app).post('/api/login').send({
      email: 'teacher@school.com',
      password: 'teach123',
      role: 'teacher'
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toEqual('teacher');
    teacherToken = res.body.token;
  });

  test('4. Authentication - Reject Invalid Credentials', async () => {
    const res = await request(app).post('/api/login').send({
      email: 'teacher@school.com',
      password: 'wrongpassword',
      role: 'teacher'
    });
    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
  });

  test('5. Protected Endpoint Access Control (Reject Unauthenticated)', async () => {
    const res = await request(app).get('/api/students');
    expect(res.statusCode).toEqual(401);
  });

  test('6. Role Authorization - Admin Student Management (Create & Soft Delete)', async () => {
    const newStudent = {
      name: 'Test Student Jest',
      email: `testjest_${Date.now()}@school.com`,
      password: 'testpassword123',
      class_id: 1,
      phone: '099-888-777'
    };

    // Create student
    const createRes = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newStudent);

    expect(createRes.statusCode).toEqual(200);
    expect(createRes.body.id).toBeDefined();
    const createdId = createRes.body.id;

    // Soft delete student
    const delRes = await request(app)
      .delete(`/api/students/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.statusCode).toEqual(200);
    expect(delRes.body.success).toBe(true);
  });

  test('7. Teacher Class Scoping Protection', async () => {
    const res = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Teacher 1 (Sarah) is assigned to Grade 10-A and Grade 11-A
    res.body.forEach(c => {
      expect(c.teacher_id).toEqual(1);
    });
  });

  test('8. Bulk Attendance Atomic Transaction', async () => {
    const bulkData = [
      { student_id: 1, class_id: 1, date: '2026-08-05', status: 'present', remark: 'Automated test' },
      { student_id: 2, class_id: 1, date: '2026-08-05', status: 'absent', remark: 'Sick test' }
    ];

    const res = await request(app)
      .post('/api/attendance/bulk')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(bulkData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toEqual(2);
  });

  test('9. Audit Logs Recording', async () => {
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('10. Secure Password Recovery API', async () => {
    const res = await request(app)
      .post('/api/auth/recover-password')
      .send({
        email: 'carol@school.com',
        newPassword: 'newsecurepassword123',
        role: 'student'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });
});
