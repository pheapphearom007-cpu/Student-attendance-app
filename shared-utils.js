// ============================================================
//  SHARED DATA STORE & UTILITIES (CONNECTED TO BACKEND API)
// ============================================================
const API_URL = window.location.protocol.startsWith('http') 
  ? window.location.origin + '/api' 
  : 'http://localhost:5000/api';

function setToken(token) {
  if (!token) return;
  localStorage.setItem('atk_token', token);
  document.cookie = `atk_token=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
}

function getToken() {
  const localToken = localStorage.getItem('atk_token');
  if (localToken) return localToken;
  const match = document.cookie.match(/(?:^|; )atk_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function removeToken() {
  localStorage.removeItem('atk_token');
  document.cookie = 'atk_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

const DB = {
  get(key) { try { return JSON.parse(localStorage.getItem('atk_'+key)) || []; } catch{ return []; } },
  set(key, val) { 
    localStorage.setItem('atk_'+key, JSON.stringify(val));
    // Asynchronously push to backend SQLite DB server
    const token = getToken();
    fetch(`${API_URL}/sync/${key}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(val)
    }).catch(err => console.warn('Backend sync warning:', err.message));
  },
  getObj(key, def={}) { try { return JSON.parse(localStorage.getItem('atk_'+key)) || def; } catch{ return def; } },
  setObj(key, val) { localStorage.setItem('atk_'+key, JSON.stringify(val)); }
};

let currentUser = null;

async function syncWithBackend() {
  try {
    const res = await fetch(`${API_URL}/db/all`);
    if (res.ok) {
      const data = await res.json();
      if (data.classes) localStorage.setItem('atk_classes', JSON.stringify(data.classes));
      if (data.teachers) localStorage.setItem('atk_teachers', JSON.stringify(data.teachers));
      if (data.students) localStorage.setItem('atk_students', JSON.stringify(data.students));
      if (data.attendance) localStorage.setItem('atk_attendance', JSON.stringify(data.attendance));
      if (data.admin) localStorage.setItem('atk_admin', JSON.stringify(data.admin));
      localStorage.setItem('atk_initialized', '1');
    }
  } catch (err) {
    console.warn('Backend API server not reachable, using local storage cache.');
  }
}

function initData() {
  syncWithBackend();

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
    DB.setObj('admin', {name:'Admin User', email:'phirom007kh@gmail.com'});
    localStorage.setItem('atk_initialized','1');
  }
}

function getCurrentUser() {
  currentUser = JSON.parse(localStorage.getItem('atk_currentUser')) || null;
  return currentUser;
}

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('atk_currentUser', JSON.stringify(user));
}

function logout() {
  removeToken();
  localStorage.removeItem('atk_currentUser');
  window.location.href = 'attendance_system.html';
}

async function verifyBackendToken() {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        initLayout();
        return true;
      }
    }
  } catch (e) {
    console.warn('Backend token verification skipped offline');
  }
  return true;
}

function checkAuth() {
  const user = getCurrentUser();
  const token = getToken();

  if (!user && !token) {
    if (!window.location.pathname.endsWith('attendance_system.html') && !window.location.pathname.endsWith('index.html')) {
      window.location.href = 'attendance_system.html';
    }
    return false;
  }

  // Asynchronously verify token with server
  verifyBackendToken();
  return true;
}

function initLayout() {
  const user = getCurrentUser();
  if (!user) return;

  // Update user display
  const avatar = document.getElementById('user-avatar');
  if (avatar) {
    avatar.innerHTML = '<img src="Picture1.png" alt="User Avatar">';
    avatar.className = 'avatar';
    if (user.role==='teacher') avatar.classList.add('green');
    if (user.role==='student') avatar.classList.add('amber');
  }
  
  const nameEl = document.getElementById('user-name-display');
  if (nameEl) nameEl.textContent = user.name;

  const emailEl = document.getElementById('user-email-display');
  if (emailEl) emailEl.textContent = user.email;

  const badgeEl = document.getElementById('role-badge');
  if (badgeEl && user.role) badgeEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  // Setup navigation
  const navs = {
    admin: [
      {icon:'ti-layout-dashboard', label:'Dashboard', page:'admin-dashboard.html'},
      {icon:'ti-users', label:'Students', page:'admin-students.html'},
      {icon:'ti-chalkboard', label:'Teachers', page:'admin-teachers.html'},
      {icon:'ti-school', label:'Classes', page:'admin-classes.html'},
      {icon:'ti-report-analytics', label:'Attendance Reports', page:'admin-reports.html'},
    ],
    teacher: [
      {icon:'ti-layout-dashboard', label:'Dashboard', page:'teacher-dashboard.html'},
      {icon:'ti-calendar-plus', label:'Take Attendance', page:'teacher-attendance.html'},
      {icon:'ti-history', label:'Attendance History', page:'teacher-history.html'},
      {icon:'ti-chart-bar', label:'Reports', page:'teacher-reports.html'},
    ],
    student: [
      {icon:'ti-layout-dashboard', label:'Dashboard', page:'student-dashboard.html'},
      {icon:'ti-calendar-stats', label:'My Attendance', page:'student-attendance.html'},
      {icon:'ti-chart-pie', label:'Statistics', page:'student-stats.html'},
    ]
  };

  const nav = document.getElementById('sidebar-nav');
  if (nav && user.role) {
    nav.innerHTML = '';
    const items = navs[user.role] || [];
    const currentPage = window.location.pathname.split('/').pop();
    
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'nav-item' + (item.page === currentPage ? ' active' : '');
      btn.innerHTML = `<i class="ti ${item.icon}"></i><span>${item.label}</span>`;
      btn.onclick = () => { window.location.href = item.page; };
      nav.appendChild(btn);
    });
  }
}

// Shared function for attendance tables
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

function showModal() { document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initData();
  const user = getCurrentUser();
  if (user) {
    initLayout();
  }
});
