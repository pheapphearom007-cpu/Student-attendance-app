// ============================================================
//  ADMIN REPORTS PAGE
// ============================================================

var pages = window.pages = window.pages || {};

pages.adminReports = function() {
  const att = DB.get('attendance');
  const students = DB.get('students');
  const classes = DB.get('classes');
  const total = att.length;
  const present = att.filter(a=>a.status==='present').length;
  const absent = att.filter(a=>a.status==='absent').length;
  const late = att.filter(a=>a.status==='late').length;
  const excused = att.filter(a=>a.status==='excused').length;
  const rate = total ? Math.round(present/total*100) : 0;

  mc().innerHTML = `
    <div class="page-header"><h1>Attendance Reports</h1><p>View and export attendance data.</p></div>
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-label">Attendance Rate</div><div class="stat-value stat-blue">${rate}%</div></div>
      <div class="stat-card"><div class="stat-label">Present</div><div class="stat-value stat-green">${present}</div></div>
      <div class="stat-card"><div class="stat-label">Absent</div><div class="stat-value stat-red">${absent}</div></div>
      <div class="stat-card"><div class="stat-label">Late</div><div class="stat-value stat-amber">${late}</div></div>
      <div class="stat-card"><div class="stat-label">Excused</div><div class="stat-value stat-blue">${excused}</div></div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div><label>Filter by Class</label><select id="r-class" onchange="renderReportTable()" style="width:180px">
        <option value="">All Classes</option>
        ${classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
      </select></div>
      <div><label>Date From</label><input type="date" id="r-from" onchange="renderReportTable()" style="width:160px"></div>
      <div><label>Date To</label><input type="date" id="r-to" onchange="renderReportTable()" style="width:160px"></div>
      <div style="display:flex;align-items:flex-end">
        <button class="btn btn-success" onclick="exportCSV()"><i class="ti ti-file-export"></i> Export CSV</button>
      </div>
    </div>
    <div class="card" id="report-table-wrap">
      ${buildReportTable('')}
    </div>
    <div class="card" style="margin-top:16px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px">Student Attendance Summary</h3>
      ${studentSummary(att, students, classes)}
    </div>`;
};

function renderReportTable() {
  document.getElementById('report-table-wrap').innerHTML = buildReportTable('');
}

function buildReportTable(filter) {
  let att = DB.get('attendance');
  const students = DB.get('students');
  const classes = DB.get('classes');
  const classFilter = document.getElementById('r-class') ? parseInt(document.getElementById('r-class').value)||0 : 0;
  const fromDate = document.getElementById('r-from') ? document.getElementById('r-from').value : '';
  const toDate = document.getElementById('r-to') ? document.getElementById('r-to').value : '';
  if (classFilter) att = att.filter(a=>a.class_id===classFilter);
  if (fromDate) att = att.filter(a=>a.date>=fromDate);
  if (toDate) att = att.filter(a=>a.date<=toDate);
  att = att.slice().reverse();
  return recentAttTable(att);
}

function studentSummary(att, students, classes) {
  return `<table><thead><tr><th>Student</th><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr></thead><tbody>
  ${students.map(s=>{
    const sa = att.filter(a=>a.student_id===s.id);
    const p = sa.filter(a=>a.status==='present').length;
    const ab = sa.filter(a=>a.status==='absent').length;
    const l = sa.filter(a=>a.status==='late').length;
    const total = sa.length;
    const rate = total ? Math.round(p/total*100) : 0;
    const cl = classes.find(c=>c.id===s.class_id)||{name:'—'};
    const color = rate>=80?'progress-green':rate>=60?'progress-amber':'progress-red';
    return `<tr>
      <td><strong style="font-weight:500">${s.name}</strong></td>
      <td><span class="badge badge-excused">${cl.name}</span></td>
      <td style="color:var(--success)">${p}</td>
      <td style="color:var(--danger)">${ab}</td>
      <td style="color:var(--warning)">${l}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;min-width:120px">
          <div class="progress-bar" style="flex:1"><div class="progress-fill ${color}" style="width:${rate}%"></div></div>
          <span style="font-size:13px;font-weight:500;min-width:36px">${rate}%</span>
        </div>
      </td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}

function exportCSV() {
  const att = DB.get('attendance');
  const students = DB.get('students');
  const classes = DB.get('classes');
  let csv = 'Student,Email,Class,Date,Status,Remark\n';
  att.forEach(a=>{
    const s = students.find(x=>x.id===a.student_id)||{name:'Unknown',email:''};
    const c = classes.find(x=>x.id===a.class_id)||{name:'Unknown'};
    csv += `"${s.name}","${s.email}","${c.name}","${a.date}","${a.status}","${a.remark||''}"\n`;
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='attendance_report.csv'; a.click();
}
