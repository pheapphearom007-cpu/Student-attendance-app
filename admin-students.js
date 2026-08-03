// ============================================================
//  MANAGE STUDENTS PAGE
// ============================================================

pages.manageStudents = function(search='') {
  let students = DB.get('students');
  if (search) students = students.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())||s.email.toLowerCase().includes(search));
  const classes = DB.get('classes');
  mc().innerHTML = `
    <div class="page-header"><h1>Manage Students</h1><p>Add, edit, or remove students from the system.</p></div>
    <div class="search-bar">
      <input type="text" placeholder="Search students..." id="student-search" value="${search}" oninput="pages.manageStudents(this.value)">
      <button class="btn btn-primary" onclick="openStudentModal()"><i class="ti ti-user-plus"></i> Add Student</button>
    </div>
    <div class="card">
      <table><thead><tr><th>Name</th><th>Email</th><th>Class</th><th>Phone</th><th>Actions</th></tr></thead><tbody>
      ${students.map(s=>{
        const cl = classes.find(c=>c.id===s.class_id)||{name:'—'};
        return `<tr>
          <td><strong style="font-weight:500">${s.name}</strong></td>
          <td style="color:var(--gray-600)">${s.email}</td>
          <td><span class="badge badge-excused">${cl.name}</span></td>
          <td style="color:var(--gray-600)">${s.phone||'—'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openStudentModal(${s.id})"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteStudent(${s.id})"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`;
      }).join('') || '<tr><td colspan="5"><div class="empty-state"><i class="ti ti-users-off"></i><p>No students found.</p></div></td></tr>'}
      </tbody></table>
    </div>`;
};

function openStudentModal(id=null) {
  const classes = DB.get('classes');
  const s = id ? DB.get('students').find(x=>x.id===id) : null;
  document.getElementById('modal-title').textContent = s ? 'Edit Student' : 'Add Student';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Full Name</label><input id="m-name" value="${s?s.name:''}" placeholder="Full Name"></div>
    <div class="form-group"><label>Email</label><input id="m-email" type="email" value="${s?s.email:''}" placeholder="Email"></div>
    <div class="form-group"><label>Password</label><input id="m-pwd" type="password" value="${s?s.password:''}" placeholder="Password"></div>
    <div class="form-group"><label>Phone</label><input id="m-phone" value="${s?s.phone:''}" placeholder="Phone Number"></div>
    <div class="form-group"><label>Class</label><select id="m-class">
      <option value="">Select Class</option>
      ${classes.map(c=>`<option value="${c.id}" ${s&&s.class_id===c.id?'selected':''}>${c.name}</option>`).join('')}
    </select></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-primary" onclick="saveStudent(${id||0})"><i class="ti ti-check"></i> Save</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
  showModal();
}

function saveStudent(id) {
  const name = document.getElementById('m-name').value.trim();
  const email = document.getElementById('m-email').value.trim();
  const pwd = document.getElementById('m-pwd').value;
  const phone = document.getElementById('m-phone').value.trim();
  const class_id = parseInt(document.getElementById('m-class').value)||0;
  if (!name||!email) { alert('Name and email are required.'); return; }
  const students = DB.get('students');
  if (id) {
    const idx = students.findIndex(s=>s.id===id);
    if (idx>=0) students[idx] = {...students[idx], name, email, phone, class_id, password:pwd||students[idx].password};
  } else {
    const newId = students.length ? Math.max(...students.map(s=>s.id))+1 : 1;
    students.push({id:newId, name, email, password:pwd||'student123', phone, class_id});
  }
  DB.set('students', students);
  closeModal();
  pages.manageStudents();
}

function deleteStudent(id) {
  if (!confirm('Delete this student? All attendance records will be kept.')) return;
  DB.set('students', DB.get('students').filter(s=>s.id!==id));
  pages.manageStudents();
}
