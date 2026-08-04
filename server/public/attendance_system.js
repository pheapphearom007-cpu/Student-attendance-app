// ============================================================
//  DATA STORE (localStorage-backed)
// ============================================================
const DB = {
  get(key) { try { return JSON.parse(localStorage.getItem('atk_'+key)) || []; } catch{ return []; } },
  set(key, val) { localStorage.setItem('atk_'+key, JSON.stringify(val)); },
  getObj(key, def={}) { try { return JSON.parse(localStorage.getItem('atk_'+key)) || def; } catch{ return def; } },
  setObj(key, val) { localStorage.setItem('atk_'+key, JSON.stringify(val)); }
};

function initData() {
  if (!localStorage.getItem('atk_initialized')) {
    DB.set('classes', [
      {id:1, name:'Grade 10-A', teacher_id:1},
      {id:2, name:'Grade 10-B', teacher_id:2},
      {id:3, name:'Grade 11-A', teacher_id:1},
    ]);
    DB.set('teachers', [
      {id:1, name:'Sarah Johnson', email:'teacher@school.com', password:'teach123', subject:'Mathematics'},
      {id:2, name:'Mike Chen', email:'mike@school.com', password:'teach456', subject:'Science'},
    ]);
    DB.set('students', [
      {id:1, name:'Alice Smith', email:'student@school.com', password:'stu123', class_id:1, phone:'012-345-6789'},
      {id:2, name:'Bob Lee', email:'bob@school.com', password:'stu456', class_id:1, phone:'012-345-6790'},
      {id:3, name:'Carol White', email:'carol@school.com', password:'stu789', class_id:1, phone:'012-345-6791'},
      {id:4, name:'David Brown', email:'david@school.com', password:'stu000', class_id:2, phone:'012-345-6792'},
      {id:5, name:'Eva Green', email:'eva@school.com', password:'stu001', class_id:2, phone:'012-345-6793'},
      {id:6, name:'Frank Kim', email:'frank@school.com', password:'stu002', class_id:3, phone:'012-345-6794'},
    ]);
    DB.set('attendance', [
      {id:1, student_id:1, class_id:1, date:'2025-06-01', status:'present', remark:''},
      {id:2, student_id:2, class_id:1, date:'2025-06-01', status:'absent', remark:'Sick'},
      {id:3, student_id:3, class_id:1, date:'2025-06-01', status:'present', remark:''},
      {id:4, student_id:1, class_id:1, date:'2025-06-02', status:'late', remark:'Traffic'},
      {id:5, student_id:2, class_id:1, date:'2025-06-02', status:'present', remark:''},
      {id:6, student_id:3, class_id:1, date:'2025-06-02', status:'excused', remark:'Doctor'},
      {id:7, student_id:4, class_id:2, date:'2025-06-01', status:'present', remark:''},
      {id:8, student_id:5, class_id:2, date:'2025-06-01', status:'present', remark:''},
    ]);
    DB.setObj('admin', {name:'Admin User', email:'phirom007kh@gmail.com', password:'nha061106'});
    localStorage.setItem('atk_initialized','1');
  }

  const currentAdmin = DB.getObj('admin', {});
  if (currentAdmin.email !== 'phirom007kh@gmail.com' || currentAdmin.password !== 'nha061106') {
    DB.setObj('admin', {name:'Admin User', email:'phirom007kh@gmail.com', password:'nha061106'});
  }
}

// ============================================================
//  AUTH
// ============================================================
let currentUser = null;
let selectedRole = 'admin';

function switchRole(role) {
  selectedRole = role;
  document.querySelectorAll('.login-tab').forEach((t,i)=>t.classList.toggle('active',['admin','teacher','student'][i]===role));
  const emails = {admin:'phirom007kh@gmail.com',teacher:'teacher@school.com',student:'student@school.com'};
  const pwds = {admin:'nha061106',teacher:'teach123',student:'stu123'};
  document.getElementById('login-email').value = emails[role];
  document.getElementById('login-password').value = pwds[role];
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  const role = selectedRole;
  let user = null;

  if (role === 'admin') {
    const a = DB.getObj('admin');
    if (a.email === email && a.password === pw) user = {...a, role:'admin'};
  } else if (role === 'teacher') {
    const t = DB.get('teachers').find(t => t.email===email && t.password===pw);
    if (t) user = {...t, role:'teacher'};
  } else {
    const s = DB.get('students').find(s => s.email===email && s.password===pw);
    if (s) user = {...s, role:'student'};
  }

  if (!user) { document.getElementById('login-alert').classList.remove('hidden'); return; }
  document.getElementById('login-alert').classList.add('hidden');
  currentUser = user;
  showApp();
}

function logout() {
  currentUser = null;
  document.getElementById('app-layout').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
}

// ============================================================
//  APP SHELL
// ============================================================
function showApp() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app-layout').classList.remove('hidden');

  const avatar = document.getElementById('user-avatar');
  avatar.innerHTML = '<img src="Picture1.png" alt="User Avatar">';
  avatar.className = 'avatar';
  if (currentUser.role==='teacher') avatar.classList.add('green');
  if (currentUser.role==='student') avatar.classList.add('amber');
  document.getElementById('user-name-display').textContent = currentUser.name;
  document.getElementById('user-email-display').textContent = currentUser.email;
  document.getElementById('role-badge').textContent = currentUser.role.charAt(0).toUpperCase()+currentUser.role.slice(1);

  const navs = {
    admin: [
      {icon:'ti-layout-dashboard', label:'Dashboard', page:'adminDashboard'},
      {icon:'ti-users', label:'Students', page:'manageStudents'},
      {icon:'ti-chalkboard', label:'Teachers', page:'manageTeachers'},
      {icon:'ti-school', label:'Classes', page:'manageClasses'},
      {icon:'ti-report-analytics', label:'Attendance Reports', page:'adminReports'},
    ],
    teacher: [
      {icon:'ti-layout-dashboard', label:'Dashboard', page:'teacherDashboard'},
      {icon:'ti-calendar-plus', label:'Take Attendance', page:'takeAttendance'},
      {icon:'ti-history', label:'Attendance History', page:'teacherHistory'},
      {icon:'ti-chart-bar', label:'Reports', page:'teacherReports'},
    ],
    student: [
      {icon:'ti-layout-dashboard', label:'Dashboard', page:'studentDashboard'},
      {icon:'ti-calendar-stats', label:'My Attendance', page:'studentAttendance'},
      {icon:'ti-chart-pie', label:'Statistics', page:'studentStats'},
    ]
  };

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  navs[currentUser.role].forEach((item, idx) => {
    const btn = document.createElement('button');
    btn.className = 'nav-item' + (idx===0?' active':'');
    btn.innerHTML = `<i class="ti ${item.icon}"></i><span>${item.label}</span>`;
    btn.onclick = () => { document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); btn.classList.add('active'); loadPage(item.page); };
    nav.appendChild(btn);
  });

  loadPage(navs[currentUser.role][0].page);
}

function loadPage(page) { pages[page] && pages[page](); }

// ============================================================
//  SHARED UTILITIES
// ============================================================
const pages = {};
const mc = () => document.getElementById('main-content');

// Shared function used by all pages for displaying attendance tables
function recentAttTable(att) {
  const students = DB.get('students');
  const classes = DB.get('classes');
  if (!att.length) return `<div class="empty-state"><i class="ti ti-calendar-off"></i><p>No attendance records yet.</p></div>`;
  return `<table><thead><tr><th>Student</th><th>Class</th><th>Date</th><th>Status</th><th>Remark</th></tr></thead><tbody>
    ${att.map(a=>{
      const s = students.find(x=>x.id===a.student_id)||{name:'Unknown'};
      const c = classes.find(x=>x.id===a.class_id)||{name:'Unknown'};
      return `<tr><td>${s.name}</td><td>${c.name}</td><td>${a.date}</td><td><span class="badge badge-${a.status}">${a.status}</span></td><td style="color:var(--gray-600);font-size:13px">${a.remark||'—'}</td></tr>`;
    }).join('')}
  </tbody></table>`;
}

// ---------- TEACHER DASHBOARD ----------
pages.teacherDashboard = function() {
  const classes = DB.get('classes').filter(c=>c.teacher_id===currentUser.id);
  const students = DB.get('students');
  const att = DB.get('attendance');
  const today = new Date().toISOString().split('T')[0];
  mc().innerHTML = `
    <div class="page-header"><h1>Teacher Dashboard</h1><p>Welcome, ${currentUser.name}!</p></div>
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-label">My Classes</div><div class="stat-value stat-blue">${classes.length}</div></div>
      <div class="stat-card"><div class="stat-label">My Students</div><div class="stat-value stat-green">${students.filter(s=>classes.some(c=>c.id===s.class_id)).length}</div></div>
      <div class="stat-card"><div class="stat-label">Records Today</div><div class="stat-value stat-amber">${att.filter(a=>a.date===today&&classes.some(c=>c.id===a.class_id)).length}</div></div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">My Classes</h3>
      ${classes.length ? classes.map(c=>{
        const sc = students.filter(s=>s.class_id===c.id);
        const todayDone = att.filter(a=>a.class_id===c.id&&a.date===today).length;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--gray-50)">
          <div>
            <div style="font-size:14px;font-weight:500">${c.name}</div>
            <div style="font-size:12px;color:var(--gray-600)">${sc.length} students · ${todayDone>0?'<span style="color:var(--success)">Attendance taken today</span>':'<span style="color:var(--warning)">Pending today</span>'}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="loadPage('takeAttendance')"><i class="ti ti-calendar-plus"></i> Take Attendance</button>
        </div>`;
      }).join('') : '<div class="empty-state"><i class="ti ti-school-off"></i><p>No classes assigned yet.</p></div>'}
    </div>
    <div class="card">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">Recent Attendance</h3>
      ${recentAttTable(att.filter(a=>classes.some(c=>c.id===a.class_id)).slice(-8).reverse())}
    </div>`;
};

// ---------- TAKE ATTENDANCE ----------
pages.takeAttendance = function() {
  const classes = DB.get('classes').filter(c=>c.teacher_id===currentUser.id);
  const today = new Date().toISOString().split('T')[0];
  mc().innerHTML = `
    <div class="page-header"><h1>Take Attendance</h1><p>Mark attendance for your class.</p></div>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px"><label>Select Class</label>
          <select id="att-class" onchange="loadAttStudents()">
            <option value="">Choose class...</option>
            ${classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div><label>Date</label><input type="date" id="att-date" value="${today}" onchange="loadAttStudents()" style="width:160px"></div>
      </div>
    </div>
    <div id="att-students-area"></div>`;
};

function loadAttStudents() {
  const classId = parseInt(document.getElementById('att-class').value)||0;
  const date = document.getElementById('att-date').value;
  if (!classId || !date) { document.getElementById('att-students-area').innerHTML=''; return; }
  const students = DB.get('students').filter(s=>s.class_id===classId);
  const att = DB.get('attendance');
  const existing = att.filter(a=>a.class_id===classId && a.date===date);

  if (!students.length) { document.getElementById('att-students-area').innerHTML=`<div class="empty-state"><i class="ti ti-users-off"></i><p>No students in this class.</p></div>`; return; }

  const statuses = ['present','absent','late','excused'];
  let html = `<div id="att-alert" class="hidden"></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h3 style="font-size:15px;font-weight:600">${students.length} Students</h3>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="markAll('present')"><i class="ti ti-check"></i> All Present</button>
          <button class="btn btn-primary" onclick="saveAttendance(${classId},'${date}')"><i class="ti ti-device-floppy"></i> Save Attendance</button>
        </div>
      </div>
      <div class="att-grid" id="att-grid">`;
  students.forEach(s=>{
    const ex = existing.find(a=>a.student_id===s.id);
    const cur = ex ? ex.status : '';
    html += `<div class="att-row" id="att-row-${s.id}">
      <div class="avatar" style="width:32px;height:32px;font-size:12px;flex-shrink:0">${s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
      <div class="att-name">${s.name} <span class="att-id">ID:${s.id}</span></div>
      <div class="status-btns">
        ${statuses.map(st=>`<button class="status-btn ${cur===st?'selected-'+st:''}" onclick="setStatus(${s.id},'${st}',this)" data-student="${s.id}" data-status="${st}">${st.charAt(0).toUpperCase()+st.slice(1)}</button>`).join('')}
      </div>
      <input type="text" placeholder="Remark..." style="width:120px;font-size:12px;padding:5px 8px" id="remark-${s.id}" value="${ex?ex.remark||'':''}">
    </div>`;
  });
  html += `</div></div>`;
  document.getElementById('att-students-area').innerHTML = html;
}

function setStatus(studentId, status, btn) {
  const row = document.getElementById('att-row-'+studentId);
  row.querySelectorAll('.status-btn').forEach(b=>b.className='status-btn');
  btn.classList.add('selected-'+status);
  btn.dataset.active = '1';
}

function markAll(status) {
  document.querySelectorAll('.status-btn').forEach(btn=>{
    if (btn.dataset.status===status) { btn.click(); }
  });
}

async function saveAttendance(classId, date) {
  const students = DB.get('students').filter(s=>s.class_id===classId);
  const entries = [];
  let saved = 0;

  students.forEach(s=>{
    const statusBtn = document.querySelector(`#att-row-${s.id} .status-btn[class*="selected-"]`);
    if (!statusBtn) return;
    const status = statusBtn.dataset.status;
    const remark = document.getElementById('remark-'+s.id)?.value||'';
    entries.push({ student_id:s.id, class_id:classId, date, status, remark });
    saved++;
  });

  if (!saved) {
    const alert = document.getElementById('att-alert');
    alert.className='alert alert-danger';
    alert.textContent='Please select a status for at least one student.';
    alert.classList.remove('hidden');
    setTimeout(()=>alert.classList.add('hidden'),3000);
    return;
  }

  try {
    const savedRows = [];
    for (const entry of entries) {
      const res = await fetch(`${window.location.origin}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to save attendance');
      }
      const savedRow = await res.json();
      savedRows.push({
        id: savedRow.id,
        student_id: savedRow.student_id,
        class_id: savedRow.class_id,
        date: savedRow.date,
        status: savedRow.status,
        remark: savedRow.remark || ''
      });
    }

    const current = DB.get('attendance').filter(a=>!(a.class_id===classId && a.date===date));
    DB.set('attendance', [...current, ...savedRows]);

    const alert = document.getElementById('att-alert');
    alert.className='alert alert-success';
    alert.textContent=`✓ Attendance saved for ${saved} students.`;
    alert.classList.remove('hidden');
    setTimeout(()=>alert.classList.add('hidden'),3000);
  } catch (error) {
    const alert = document.getElementById('att-alert');
    alert.className='alert alert-danger';
    alert.textContent='Attendance could not be saved to the server. Please try again.';
    alert.classList.remove('hidden');
    console.error(error);
  }
}

// ---------- TEACHER HISTORY ----------
pages.teacherHistory = function() {
  const classes = DB.get('classes').filter(c=>c.teacher_id===currentUser.id);
  let att = DB.get('attendance').filter(a=>classes.some(c=>c.id===a.class_id));
  mc().innerHTML = `
    <div class="page-header"><h1>Attendance History</h1><p>Review past attendance records for your classes.</p></div>
    <div class="card">
      <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap">
        <select id="h-class" onchange="filterHistory()" style="width:160px">
          <option value="">All Classes</option>
          ${classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <input type="date" id="h-date" onchange="filterHistory()" style="width:150px">
      </div>
      <div id="history-table">${recentAttTable(att.slice().reverse().slice(0,20))}</div>
    </div>`;
};

function filterHistory() {
  const classId = parseInt(document.getElementById('h-class').value)||0;
  const date = document.getElementById('h-date').value;
  const classes = DB.get('classes').filter(c=>c.teacher_id===currentUser.id);
  let att = DB.get('attendance').filter(a=>classes.some(c=>c.id===a.class_id));
  if (classId) att = att.filter(a=>a.class_id===classId);
  if (date) att = att.filter(a=>a.date===date);
  document.getElementById('history-table').innerHTML = recentAttTable(att.slice().reverse());
}

// ---------- TEACHER REPORTS ----------
pages.teacherReports = function() {
  const classes = DB.get('classes').filter(c=>c.teacher_id===currentUser.id);
  const students = DB.get('students');
  const att = DB.get('attendance').filter(a=>classes.some(c=>c.id===a.class_id));
  mc().innerHTML = `
    <div class="page-header"><h1>Class Reports</h1><p>Attendance summary for your classes.</p></div>
    ${classes.map(c=>{
      const sc = students.filter(s=>s.class_id===c.id);
      const ca = att.filter(a=>a.class_id===c.id);
      return `<div class="card" style="margin-bottom:16px">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">${c.name}</h3>
        <table><thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr></thead><tbody>
        ${sc.map(s=>{
          const sa = ca.filter(a=>a.student_id===s.id);
          const p = sa.filter(a=>a.status==='present').length;
          const ab = sa.filter(a=>a.status==='absent').length;
          const l = sa.filter(a=>a.status==='late').length;
          const total = sa.length;
          const rate = total ? Math.round(p/total*100) : 0;
          const color = rate>=80?'progress-green':rate>=60?'progress-amber':'progress-red';
          return `<tr>
            <td>${s.name}</td>
            <td style="color:var(--success)">${p}</td>
            <td style="color:var(--danger)">${ab}</td>
            <td style="color:var(--warning)">${l}</td>
            <td><div style="display:flex;align-items:center;gap:8px">
              <div class="progress-bar" style="width:80px"><div class="progress-fill ${color}" style="width:${rate}%"></div></div>
              <span style="font-size:13px;font-weight:500">${rate}%</span>
            </div></td>
          </tr>`;
        }).join('')||`<tr><td colspan="5"><div class="empty-state" style="padding:16px"><i class="ti ti-users-off"></i><p>No students.</p></div></td></tr>`}
        </tbody></table>
      </div>`;
    }).join('')||`<div class="empty-state"><i class="ti ti-school-off"></i><p>No classes assigned.</p></div>`}`;
};

// ---------- STUDENT DASHBOARD ----------
pages.studentDashboard = function() {
  const att = DB.get('attendance').filter(a=>a.student_id===currentUser.id);
  const cl = DB.get('classes').find(c=>c.id===currentUser.class_id)||{name:'—'};
  const t = DB.get('teachers').find(x=>x.id===cl.teacher_id)||{name:'—'};
  const p = att.filter(a=>a.status==='present').length;
  const total = att.length;
  const rate = total ? Math.round(p/total*100) : 0;
  const color = rate>=80?'stat-green':rate>=60?'stat-amber':'stat-red';
  mc().innerHTML = `
    <div class="page-header"><h1>My Dashboard</h1><p>Welcome, ${currentUser.name}!</p></div>
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-label">Attendance Rate</div><div class="stat-value ${color}">${rate}%</div></div>
      <div class="stat-card"><div class="stat-label">Total Classes</div><div class="stat-value stat-blue">${total}</div></div>
      <div class="stat-card"><div class="stat-label">Present</div><div class="stat-value stat-green">${p}</div></div>
      <div class="stat-card"><div class="stat-label">Absent</div><div class="stat-value stat-red">${att.filter(a=>a.status==='absent').length}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">My Class Info</h3>
        <div style="line-height:2;font-size:14px">
          <div><span style="color:var(--gray-600)">Class:</span> <strong>${cl.name}</strong></div>
          <div><span style="color:var(--gray-600)">Teacher:</span> <strong>${t.name}</strong></div>
          <div><span style="color:var(--gray-600)">Email:</span> ${currentUser.email}</div>
          <div><span style="color:var(--gray-600)">Phone:</span> ${currentUser.phone||'—'}</div>
        </div>
      </div>
      <div class="card">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">Attendance Rate</h3>
        <div style="text-align:center;padding:10px 0">
          <div style="font-size:48px;font-weight:700;color:${rate>=80?'var(--success)':rate>=60?'var(--amber)':'var(--danger)'}">${rate}%</div>
          <div style="font-size:13px;color:var(--gray-600);margin-top:4px">${rate>=80?'Excellent! Keep it up!':rate>=60?'You can do better.':'At risk — please attend more classes.'}</div>
          <div class="progress-bar" style="margin-top:14px">
            <div class="progress-fill ${rate>=80?'progress-green':rate>=60?'progress-amber':'progress-red'}" style="width:${rate}%"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">Recent Attendance</h3>
      ${recentAttTable(att.slice(-8).reverse())}
    </div>`;
};

// ---------- STUDENT ATTENDANCE ----------
pages.studentAttendance = function() {
  const att = DB.get('attendance').filter(a=>a.student_id===currentUser.id);
  const classes = DB.get('classes');
  mc().innerHTML = `
    <div class="page-header"><h1>My Attendance</h1><p>Full attendance history.</p></div>
    <div class="card">
      <div style="margin-bottom:12px;display:flex;gap:8px">
        <select id="s-status" onchange="filterStudentAtt()" style="width:140px">
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="excused">Excused</option>
        </select>
        <input type="month" id="s-month" onchange="filterStudentAtt()" style="width:150px">
      </div>
      <div id="s-att-table">${recentAttTable(att.slice().reverse())}</div>
    </div>`;
};

function filterStudentAtt() {
  const status = document.getElementById('s-status').value;
  const month = document.getElementById('s-month').value;
  let att = DB.get('attendance').filter(a=>a.student_id===currentUser.id);
  if (status) att = att.filter(a=>a.status===status);
  if (month) att = att.filter(a=>a.date.startsWith(month));
  document.getElementById('s-att-table').innerHTML = recentAttTable(att.slice().reverse());
}

// ---------- STUDENT STATS ----------
pages.studentStats = function() {
  const att = DB.get('attendance').filter(a=>a.student_id===currentUser.id);
  const total = att.length;
  const p = att.filter(a=>a.status==='present').length;
  const ab = att.filter(a=>a.status==='absent').length;
  const l = att.filter(a=>a.status==='late').length;
  const ex = att.filter(a=>a.status==='excused').length;
  const rate = total ? Math.round(p/total*100) : 0;

  const byMonth = {};
  att.forEach(a=>{
    const m = a.date.slice(0,7);
    if (!byMonth[m]) byMonth[m] = {present:0,absent:0,late:0,excused:0,total:0};
    byMonth[m][a.status]++;
    byMonth[m].total++;
  });

  mc().innerHTML = `
    <div class="page-header"><h1>Attendance Statistics</h1><p>Detailed breakdown of your attendance.</p></div>
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-label">Overall Rate</div><div class="stat-value ${rate>=80?'stat-green':rate>=60?'stat-amber':'stat-red'}">${rate}%</div></div>
      <div class="stat-card"><div class="stat-label">Present</div><div class="stat-value stat-green">${p}</div></div>
      <div class="stat-card"><div class="stat-label">Absent</div><div class="stat-value stat-red">${ab}</div></div>
      <div class="stat-card"><div class="stat-label">Late</div><div class="stat-value stat-amber">${l}</div></div>
      <div class="stat-card"><div class="stat-label">Excused</div><div class="stat-value stat-blue">${ex}</div></div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px">Monthly Breakdown</h3>
      ${Object.keys(byMonth).length ? `<table><thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th></tr></thead><tbody>
        ${Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([m,v])=>{
          const mr = v.total ? Math.round(v.present/v.total*100) : 0;
          const cl = mr>=80?'progress-green':mr>=60?'progress-amber':'progress-red';
          return `<tr>
            <td><strong style="font-weight:500">${m}</strong></td>
            <td style="color:var(--success)">${v.present}</td>
            <td style="color:var(--danger)">${v.absent}</td>
            <td style="color:var(--warning)">${v.late}</td>
            <td style="color:var(--primary)">${v.excused}</td>
            <td><div style="display:flex;align-items:center;gap:8px">
              <div class="progress-bar" style="width:80px"><div class="progress-fill ${cl}" style="width:${mr}%"></div></div>
              <span style="font-size:13px;font-weight:500">${mr}%</span>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody></table>` : '<div class="empty-state"><i class="ti ti-calendar-off"></i><p>No attendance data yet.</p></div>'}
    </div>`;
};

// ============================================================
//  MODAL
// ============================================================
function showModal() { document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ============================================================
//  INIT
// ============================================================
initData();
