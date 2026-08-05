// ============================================================
//  MANAGE CLASSES PAGE
// ============================================================

var pages = window.pages = window.pages || {};

pages.manageClasses = function() {
  const classes = DB.get('classes');
  const teachers = DB.get('teachers');
  const students = DB.get('students');
  mc().innerHTML = `
    <div class="page-header"><h1>Manage Classes</h1><p>Create classes and assign teachers and students.</p></div>
    <div style="margin-bottom:16px"><button class="btn btn-primary" onclick="openClassModal()"><i class="ti ti-plus"></i> Create Class</button></div>
    <div class="card">
      <table><thead><tr><th>Class Name</th><th>Assigned Teacher</th><th>Students</th><th>Actions</th></tr></thead><tbody>
      ${classes.map(c=>{
        const t = teachers.find(x=>x.id===c.teacher_id);
        const sc = students.filter(s=>s.class_id===c.id);
        return `<tr>
          <td><strong style="font-weight:500">${c.name}</strong></td>
          <td>${t?t.name:'<span style="color:var(--gray-400)">Unassigned</span>'}</td>
          <td><span class="badge badge-present">${sc.length} students</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openClassModal(${c.id})"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteClass(${c.id})"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`;
      }).join('')||'<tr><td colspan="4"><div class="empty-state"><i class="ti ti-school-off"></i><p>No classes yet.</p></div></td></tr>'}
      </tbody></table>
    </div>`;
};

function openClassModal(id=null) {
  const teachers = DB.get('teachers');
  const c = id ? DB.get('classes').find(x=>x.id===id) : null;
  document.getElementById('modal-title').textContent = c ? 'Edit Class' : 'Create Class';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Class Name</label><input id="m-cname" value="${c?c.name:''}" placeholder="e.g. Grade 10-A"></div>
    <div class="form-group"><label>Assign Teacher</label><select id="m-tid">
      <option value="">No Teacher</option>
      ${teachers.map(t=>`<option value="${t.id}" ${c&&c.teacher_id===t.id?'selected':''}>${t.name}</option>`).join('')}
    </select></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-primary" onclick="saveClass(${id||0})"><i class="ti ti-check"></i> Save</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
  showModal();
}

async function saveClass(id) {
  const name = document.getElementById('m-cname').value.trim();
  const teacher_id = parseInt(document.getElementById('m-tid').value)||null;
  if (!name) { alert('Class name is required.'); return; }

  try {
    const token = getToken();
    const headers = { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    let res;
    if (id) {
      res = await fetch(`${API_URL}/classes/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name, teacher_id })
      });
    } else {
      res = await fetch(`${API_URL}/classes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, teacher_id })
      });
    }

    if (!res.ok) {
      const err = await res.json();
      alert('Failed to save class: ' + (err.error || err.message || 'Unknown error'));
      return;
    }

    closeModal();
    await syncWithBackend(true);
    if (typeof pages !== 'undefined' && pages.manageClasses) pages.manageClasses();
  } catch (error) {
    console.error('Error saving class:', error);
    alert('Failed to connect to backend server.');
  }
}

async function deleteClass(id) {
  if (!confirm('Delete this class?')) return;
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/classes/${id}`, {
      method: 'DELETE',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (res.ok) {
      await syncWithBackend(true);
      if (typeof pages !== 'undefined' && pages.manageClasses) pages.manageClasses();
    } else {
      alert('Failed to delete class from server.');
    }
  } catch (error) {
    console.error('Error deleting class:', error);
    alert('Failed to connect to backend server.');
  }
}
