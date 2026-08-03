// ============================================================
//  MANAGE TEACHERS PAGE
// ============================================================

pages.manageTeachers = function() {
  const teachers = DB.get('teachers');
  const classes = DB.get('classes');
  mc().innerHTML = `
    <div class="page-header"><h1>Manage Teachers</h1><p>Add, edit, or remove teachers.</p></div>
    <div style="margin-bottom:16px;display:flex;gap:8px">
      <button class="btn btn-primary" onclick="openTeacherModal()"><i class="ti ti-user-plus"></i> Add Teacher</button>
      <button class="btn btn-success" onclick="exportTeachersCSV()"><i class="ti ti-file-export"></i> Export Excel</button>
    </div>
    <div class="card">
      <table><thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Classes</th><th>Actions</th></tr></thead><tbody>
      ${teachers.map(t=>{
        const tc = classes.filter(c=>c.teacher_id===t.id);
        return `<tr>
          <td><strong style="font-weight:500">${t.name}</strong></td>
          <td style="color:var(--gray-600)">${t.email}</td>
          <td>${t.subject||'—'}</td>
          <td>${tc.map(c=>`<span class="badge badge-excused" style="margin-right:4px">${c.name}</span>`).join('')||'—'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openTeacherModal(${t.id})"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteTeacher(${t.id})"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`;
      }).join('')||'<tr><td colspan="5"><div class="empty-state"><i class="ti ti-user-off"></i><p>No teachers yet.</p></div></td></tr>'}
      </tbody></table>
    </div>`;
};

function exportTeachersCSV() {
  const teachers = DB.get('teachers');
  let csv = 'ID,Name,Email,Subject\n';
  teachers.forEach(t => {
    csv += `"${t.id}","${t.name}","${t.email}","${t.subject || ''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'teachers_list.csv';
  a.click();
}

function openTeacherModal(id=null) {
  const t = id ? DB.get('teachers').find(x=>x.id===id) : null;
  document.getElementById('modal-title').textContent = t ? 'Edit Teacher' : 'Add Teacher';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Full Name</label><input id="m-name" value="${t?t.name:''}" placeholder="Full Name"></div>
    <div class="form-group"><label>Email</label><input id="m-email" type="email" value="${t?t.email:''}" placeholder="Email"></div>
    <div class="form-group"><label>Password</label><input id="m-pwd" type="password" value="${t?t.password:''}" placeholder="Password"></div>
    <div class="form-group"><label>Subject</label><input id="m-subj" value="${t?t.subject:''}" placeholder="e.g. Mathematics"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-primary" onclick="saveTeacher(${id||0})"><i class="ti ti-check"></i> Save</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
  showModal();
}

function saveTeacher(id) {
  const name = document.getElementById('m-name').value.trim();
  const email = document.getElementById('m-email').value.trim();
  const pwd = document.getElementById('m-pwd').value;
  const subject = document.getElementById('m-subj').value.trim();
  if (!name||!email) { alert('Name and email required.'); return; }
  const teachers = DB.get('teachers');
  if (id) {
    const idx = teachers.findIndex(t=>t.id===id);
    if (idx>=0) teachers[idx] = {...teachers[idx], name, email, subject, password:pwd||teachers[idx].password};
  } else {
    const newId = teachers.length ? Math.max(...teachers.map(t=>t.id))+1 : 1;
    teachers.push({id:newId, name, email, password:pwd||'teacher123', subject});
  }
  DB.set('teachers', teachers);
  closeModal();
  pages.manageTeachers();
}

function deleteTeacher(id) {
  if (!confirm('Delete this teacher?')) return;
  DB.set('teachers', DB.get('teachers').filter(t=>t.id!==id));
  pages.manageTeachers();
}
