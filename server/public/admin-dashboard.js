// ============================================================
//  ADMIN DASHBOARD PAGE
// ============================================================

pages.adminDashboard = function() {
  const students = DB.get('students');
  const teachers = DB.get('teachers');
  const classes = DB.get('classes');
  const att = DB.get('attendance');
  const today = new Date().toISOString().split('T')[0];
  const todayAtt = att.filter(a=>a.date===today);
  const presentToday = todayAtt.filter(a=>a.status==='present').length;

  mc().innerHTML = `
    <div class="page-header"><h1>Admin Dashboard</h1><p>Welcome back, ${currentUser.name}!</p></div>
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value stat-blue">${students.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Teachers</div><div class="stat-value stat-green">${teachers.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Classes</div><div class="stat-value stat-amber">${classes.length}</div></div>
      <div class="stat-card"><div class="stat-label">Present Today</div><div class="stat-value stat-green">${presentToday}</div></div>
      <div class="stat-card"><div class="stat-label">Attendance Records</div><div class="stat-value stat-blue">${att.length}</div></div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px">Recent Attendance (All Classes)</h3>
      ${recentAttTable(att.slice(-10).reverse())}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">Classes Overview</h3>
        ${classes.map(c=>{
          const tc = teachers.find(t=>t.id===c.teacher_id);
          const sc = students.filter(s=>s.class_id===c.id);
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray-50)">
            <div><div style="font-size:14px;font-weight:500">${c.name}</div><div style="font-size:12px;color:var(--gray-600)">${tc?tc.name:'Unassigned'}</div></div>
            <span class="badge badge-present">${sc.length} students</span>
          </div>`;
        }).join('')}
      </div>
      <div class="card">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">Quick Actions</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-secondary" style="justify-content:flex-start" onclick="loadPage('manageStudents')"><i class="ti ti-user-plus"></i> Add New Student</button>
          <button class="btn btn-secondary" style="justify-content:flex-start" onclick="loadPage('manageTeachers')"><i class="ti ti-user-check"></i> Add New Teacher</button>
          <button class="btn btn-secondary" style="justify-content:flex-start" onclick="loadPage('manageClasses')"><i class="ti ti-school"></i> Manage Classes</button>
          <button class="btn btn-secondary" style="justify-content:flex-start" onclick="loadPage('adminReports')"><i class="ti ti-file-export"></i> Export Reports</button>
        </div>
      </div>
    </div>`;
};
