// ============================================================
//  SHARED DATA STORE & UTILITIES (CONNECTED TO BACKEND REST API)
// ============================================================
const API_URL = (function() {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const port = window.location.port;
    if (host.includes('onrender.com') || port === '5000') {
      return window.location.origin + '/api';
    }
  }
  return 'https://student-attendance-app-lkjj.onrender.com/api';
})();

if (typeof window !== 'undefined') {
  window.pages = window.pages || {};
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  },
  getObj(key, def={}) { try { return JSON.parse(localStorage.getItem('atk_'+key)) || def; } catch{ return def; } },
  setObj(key, val) { localStorage.setItem('atk_'+key, JSON.stringify(val)); }
};

let currentUser = null;
let lastDataHash = '';
let syncIntervalId = null;

function triggerActivePageRender() {
  try {
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderStudents === 'function') renderStudents();
    if (typeof renderTeachers === 'function') renderTeachers();
    if (typeof renderClasses === 'function') renderClasses();
    if (typeof renderReports === 'function') renderReports();
    if (typeof renderTeacherAttendance === 'function') renderTeacherAttendance();
    if (typeof renderTeacherHistory === 'function') renderTeacherHistory();
    if (typeof renderTeacherReports === 'function') renderTeacherReports();
    if (typeof renderTeacherDashboard === 'function') renderTeacherDashboard();
    if (typeof renderStudentDashboard === 'function') renderStudentDashboard();
    if (typeof renderStudentAttendance === 'function') renderStudentAttendance();
    if (typeof renderStudentStats === 'function') renderStudentStats();
  } catch (e) {
    console.warn('Realtime render notice:', e);
  }
}

async function syncWithBackend(triggerRender = false) {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/db/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      removeToken();
      localStorage.removeItem('atk_currentUser');
      return;
    }
    if (res.ok) {
      const text = await res.text();
      if (text !== lastDataHash) {
        const isInitial = !lastDataHash;
        lastDataHash = text;
        const data = JSON.parse(text);
        if (data.classes) localStorage.setItem('atk_classes', JSON.stringify(data.classes));
        if (data.teachers) localStorage.setItem('atk_teachers', JSON.stringify(data.teachers));
        if (data.students) localStorage.setItem('atk_students', JSON.stringify(data.students));
        if (data.attendance) localStorage.setItem('atk_attendance', JSON.stringify(data.attendance));
        if (data.admin) localStorage.setItem('atk_admin', JSON.stringify(data.admin));
        localStorage.setItem('atk_initialized', '1');
        if (triggerRender && !isInitial) {
          triggerActivePageRender();
        }
      }
    }
  } catch (err) {
    // Offline or server unreachable fallback
  }
}

function startRealtimeSync() {
  if (syncIntervalId) clearInterval(syncIntervalId);
  const token = getToken();
  if (!token) return;
  syncIntervalId = setInterval(() => {
    const currentPage = window.location.pathname.split('/').pop() || '';
    const isPublicPage = currentPage === 'attendance_system.html' || currentPage === 'index.html' || currentPage === '';
    if (!isPublicPage) {
      syncWithBackend(true);
    }
  }, 4000);
}

function initData() {
  const currentPage = window.location.pathname.split('/').pop() || '';
  const isPublicPage = currentPage === 'attendance_system.html' || currentPage === 'index.html' || currentPage === '';
  const token = getToken();
  if (token && !isPublicPage) {
    syncWithBackend();
    startRealtimeSync();
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
  if (syncIntervalId) clearInterval(syncIntervalId);
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
    if (res.status === 401) {
      removeToken();
      localStorage.removeItem('atk_currentUser');
      const currentPage = window.location.pathname.split('/').pop() || '';
      if (currentPage && currentPage !== 'attendance_system.html' && currentPage !== 'index.html') {
        window.location.href = 'attendance_system.html';
      }
      return false;
    }
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        initLayout();
        return true;
      }
    }
  } catch (e) {
    // Token verification catch fallback
  }
  return true;
}

function checkAuth() {
  const user = getCurrentUser();
  const token = getToken();

  if (!user && !token) {
    const currentPage = window.location.pathname.split('/').pop() || '';
    if (currentPage && currentPage !== 'attendance_system.html' && currentPage !== 'index.html') {
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
      btn.innerHTML = `<i class="ti ${item.icon}"></i><span>${escapeHtml(item.label)}</span>`;
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
      return `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(a.date)}</td><td><span class="badge badge-${escapeHtml(a.status)}">${escapeHtml(a.status)}</span></td><td style="color:var(--gray-600);font-size:13px">${escapeHtml(a.remark||'—')}</td></tr>`;
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
