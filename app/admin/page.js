'use client';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import AppShell from '../../components/AppShell';
import Sidebar from '../../components/Sidebar';

function downloadTemplate() {
  const wsData = [
    ['Họ và tên', 'Email', 'Vai trò', 'Môn dạy (chỉ điền nếu là Giáo viên)', 'Lớp (HS: 1 lớp; GV: các lớp dạy, cách nhau dấu phẩy)'],
    ['Nguyễn Văn A', 'nguyenvana@example.com', 'Giáo viên', 'Toán', '12A1, 12A2'],
    ['Trần Thị B', 'tranthib@example.com', 'Học sinh', '', '12A1'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSach');
  XLSX.writeFile(wb, 'mau-nhap-tai-khoan-edugen.xlsx');
}

function normalizeRole(raw) {
  const v = (raw || '').toString().trim().toLowerCase();
  if (v.includes('giáo') || v.includes('giao vien') || v === 'teacher' || v === 'gv') return 'teacher';
  if (v.includes('học sinh') || v.includes('hoc sinh') || v === 'student' || v === 'hs') return 'student';
  return null;
}

export default function AdminPage() {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('home');
  const [stats, setStats] = useState({ teachers: 0, students: 0, classes: 0 });

  // Tạo tay 1 tài khoản
  const [role, setRole] = useState('teacher');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [subject, setSubject] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Nhập Excel
  const [excelRows, setExcelRows] = useState([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  // Lớp học
  const [className, setClassName] = useState('');
  const [classMessage, setClassMessage] = useState(null);
  const [classes, setClasses] = useState([]);
  const [openClass, setOpenClass] = useState(null);
  const [classDetail, setClassDetail] = useState({ teachers: [], students: [] });
  const [allTeachers, setAllTeachers] = useState([]);
  const [freeStudents, setFreeStudents] = useState([]);
  const [pickTeacher, setPickTeacher] = useState('');
  const [pickStudent, setPickStudent] = useState('');
  const [overview, setOverview] = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
    }
    const { data: subs } = await supabase.from('subjects').select('*').order('name');
    setSubjects(subs || []);
    if (subs && subs[0]) setSubject(subs[0].name);
    loadClasses();
    loadStats();
  }

  async function loadStats() {
    const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: classCount } = await supabase.from('classes').select('*', { count: 'exact', head: true });
    setStats({ teachers: teacherCount || 0, students: studentCount || 0, classes: classCount || 0 });
  }

  async function loadClasses() {
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false });
    setClasses(data || []);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email, fullName, role, subject }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setMessage({ type: 'error', text: json.error }); return; }
    setMessage({
      type: 'success',
      text: `Đã tạo tài khoản ${email}. Mật khẩu tạm: ${json.tempPassword} — gửi cho ${role === 'teacher' ? 'giáo viên' : 'học sinh'} để đăng nhập lần đầu.`,
    });
    setEmail(''); setFullName('');
  }

  function handleExcelFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setExcelFileName(f.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const parsed = rows.map(r => {
        const full_name = r['Họ và tên'] || r['Ho va ten'] || r['Họ tên'] || '';
        const email = r['Email'] || r['email'] || '';
        const roleRaw = r['Vai trò'] || r['Vai tro'] || r['Role'] || '';
        const subjectRaw = r['Môn dạy (chỉ điền nếu là Giáo viên)'] || r['Môn dạy'] || r['Mon day'] || '';
        const classRaw = r['Lớp (HS: 1 lớp; GV: các lớp dạy, cách nhau dấu phẩy)'] || r['Lớp'] || r['Lớp học'] || r['Lop'] || '';
        return { full_name: String(full_name).trim(), email: String(email).trim(), role: normalizeRole(roleRaw), subject: String(subjectRaw).trim(), class_names: String(classRaw).trim() };
      }).filter(r => r.full_name || r.email);
      setExcelRows(parsed);
    };
    reader.readAsArrayBuffer(f);
  }

  async function handleImport() {
    const invalid = excelRows.filter(r => !r.full_name || !r.email || !r.role);
    if (invalid.length > 0) {
      setImportResult({ error: `Có ${invalid.length} dòng thiếu Họ tên/Email/Vai trò hợp lệ (Vai trò phải ghi đúng "Giáo viên" hoặc "Học sinh"). Sửa file rồi tải lại.` });
      return;
    }
    setImporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ rows: excelRows }),
    });
    const json = await res.json();
    setImporting(false);
    setImportResult(json);
  }

  async function openClassDetail(id) {
    if (openClass === id) { setOpenClass(null); return; }
    setOpenClass(id);
    await refreshClassDetail(id);
  }

  async function refreshClassDetail(id) {
    const { data: t } = await supabase.from('class_teachers').select('teacher_id, subject, profiles:teacher_id(full_name)').eq('class_id', id);
    const { data: st } = await supabase.from('class_students').select('student_id, profiles:student_id(full_name)').eq('class_id', id);
    setClassDetail({ teachers: t || [], students: st || [] });
    const { data: teachers } = await supabase.from('profiles').select('id, full_name, subject').eq('role', 'teacher').order('full_name');
    setAllTeachers(teachers || []);
    const { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name');
    const { data: assigned } = await supabase.from('class_students').select('student_id');
    const used = new Set((assigned || []).map(x => x.student_id));
    setFreeStudents((students || []).filter(s => !used.has(s.id)));
    setPickTeacher(''); setPickStudent('');
  }

  async function addTeacherToClass(classId) {
    const t = allTeachers.find(x => x.id === pickTeacher);
    if (!t) return;
    await supabase.from('class_teachers').insert({ class_id: classId, teacher_id: t.id, subject: t.subject || '' });
    refreshClassDetail(classId);
  }
  async function removeTeacher(classId, teacherId, subject) {
    await supabase.from('class_teachers').delete().eq('class_id', classId).eq('teacher_id', teacherId).eq('subject', subject);
    refreshClassDetail(classId);
  }
  async function addStudentToClass(classId) {
    if (!pickStudent) return;
    await supabase.from('class_students').insert({ class_id: classId, student_id: pickStudent });
    refreshClassDetail(classId);
  }
  async function removeStudent(classId, studentId) {
    await supabase.from('class_students').delete().eq('class_id', classId).eq('student_id', studentId);
    refreshClassDetail(classId);
  }
  async function deleteClass(id) {
    if (!confirm('Xóa lớp này? (Học sinh/giáo viên vẫn còn, chỉ bị gỡ khỏi lớp)')) return;
    await supabase.from('classes').delete().eq('id', id);
    setOpenClass(null); loadClasses(); loadStats();
  }

  async function loadOverview() {
    const { data: asg } = await supabase.from('assignments').select('id, due_at, class_id, worksheets(title, teacher_id, subject), classes(name)').order('created_at', { ascending: false });
    const { data: subs } = await supabase.from('submissions').select('assignment_id, score, submitted_at');
    const { data: teachers } = await supabase.from('profiles').select('id, full_name').eq('role', 'teacher');
    const { data: cs } = await supabase.from('class_students').select('class_id');
    const tName = Object.fromEntries((teachers || []).map(t => [t.id, t.full_name]));
    const size = {}; (cs || []).forEach(r => { size[r.class_id] = (size[r.class_id] || 0) + 1; });
    setOverview((asg || []).map(a => {
      const list = (subs || []).filter(s => s.assignment_id === a.id && s.submitted_at);
      return { id: a.id, title: a.worksheets?.title, subject: a.worksheets?.subject, teacher: tName[a.worksheets?.teacher_id], className: a.classes?.name, total: size[a.class_id] || 0, submitted: list.length,
        avg: list.length ? (list.reduce((x, y) => x + Number(y.score || 0), 0) / list.length).toFixed(1) : null };
    }));
  }

  async function handleCreateClass(e) {
    e.preventDefault();
    setClassMessage(null);
    const { error } = await supabase.from('classes').insert({ name: className });
    if (error) { setClassMessage({ type: 'error', text: error.message }); return; }
    setClassMessage({ type: 'success', text: `Đã tạo lớp ${className}.` });
    setClassName('');
    loadClasses();
  }

  return (
    <AppShell profile={profile}>
      <div className="shell">
        <Sidebar
          items={[
            { id: 'home', icon: '📊', label: 'Trang chủ' },
            { id: 'single', icon: '👤', label: 'Tạo 1 tài khoản' },
            { id: 'excel', icon: '📥', label: 'Nhập từ Excel' },
            { id: 'class', icon: '🏫', label: 'Lớp học', badge: classes.length },
            { id: 'overview', icon: '📈', label: 'Kết quả toàn trường' },
          ]}
          active={tab}
          onSelect={(id) => { setTab(id); if (id === 'overview') loadOverview(); }}
        />
        <div className="content-area">

        {tab === 'home' && (
          <>
            <h2>Chào {profile?.full_name || 'bạn'} 👋</h2>
            <p className="muted">Bảng điều khiển Quản trị EduGen. Bạn tạo tài khoản Giáo viên/Học sinh và quản lý lớp học từ đây; nội dung dạy học do từng Giáo viên tự quản lý riêng.</p>
            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 16 }}>
              <div className="stat-card"><div className="num">{stats.teachers}</div><div className="lbl">Giáo viên</div></div>
              <div className="stat-card"><div className="num">{stats.students}</div><div className="lbl">Học sinh</div></div>
              <div className="stat-card"><div className="num">{stats.classes}</div><div className="lbl">Lớp học</div></div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3>Tỉ lệ Giáo viên / Học sinh</h3>
              {(() => { const max = Math.max(1, stats.teachers, stats.students); return (<>
                <div className="bar-row"><span className="bar-label">Giáo viên</span><div className="bar-track"><div className="bar-fill" style={{ width: `${stats.teachers / max * 100}%`, background: 'var(--navy)' }} /></div><span className="bar-value">{stats.teachers}</span></div>
                <div className="bar-row"><span className="bar-label">Học sinh</span><div className="bar-track"><div className="bar-fill" style={{ width: `${stats.students / max * 100}%`, background: 'var(--gold)' }} /></div><span className="bar-value">{stats.students}</span></div>
              </>); })()}
            </div>

            <div className="card">
              <h3>Chức năng quản trị</h3>
              <div className="row-list">
                <div><div style={{ fontWeight: 600 }}>Tạo 1 tài khoản</div><div className="muted">Tạo tay từng tài khoản Giáo viên hoặc Học sinh, hệ thống tự sinh mật khẩu tạm.</div></div>
                <button onClick={() => setTab('single')}>Mở</button>
              </div>
              <div className="row-list">
                <div><div style={{ fontWeight: 600 }}>Nhập hàng loạt từ Excel</div><div className="muted">Tải file mẫu, điền danh sách GV/HS, nhập 1 lần nhiều tài khoản — mật khẩu mặc định 12345@Edu.</div></div>
                <button onClick={() => setTab('excel')}>Mở</button>
              </div>
              <div className="row-list">
                <div><div style={{ fontWeight: 600 }}>Lớp học</div><div className="muted">Tạo, xem danh sách lớp trong trường.</div></div>
                <button onClick={() => setTab('class')}>Mở</button>
              </div>
            </div>
          </>
        )}

        {tab === 'single' && (
          <div className="card">
            <h3>Tạo tài khoản Giáo viên / Học sinh</h3>
            <form onSubmit={handleCreateUser}>
              <div className="grid-2">
                <div>
                  <label>Vai trò</label>
                  <select value={role} onChange={e => setRole(e.target.value)}>
                    <option value="teacher">Giáo viên</option>
                    <option value="student">Học sinh</option>
                  </select>
                </div>
                <div>
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>
              <label>Họ và tên</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required />
              {role === 'teacher' && (
                <>
                  <label>Môn dạy</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)}>
                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </>
              )}
              {message && <div className={message.type === 'error' ? 'error' : 'success'}>{message.text}</div>}
              <button type="submit" disabled={loading}>{loading ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
            </form>
          </div>
        )}

        {tab === 'excel' && (
          <div className="card">
            <h3>Nhập hàng loạt tài khoản từ Excel</h3>
            <p className="muted">Mật khẩu mặc định cho mọi tài khoản nhập từ Excel: <b>12345@Edu</b> (GV/HS nên đổi mật khẩu sau lần đăng nhập đầu).</p>
            <button type="button" className="ghost" onClick={downloadTemplate} style={{ marginBottom: 14 }}>Tải file mẫu Excel</button>
            <label>Chọn file Excel (.xlsx) đã điền</label>
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelFile} />
            {excelFileName && <div className="muted">Đã đọc file: {excelFileName} — {excelRows.length} dòng.</div>}

            {excelRows.length > 0 && (
              <div style={{ marginTop: 12, maxHeight: 260, overflowY: 'auto' }}>
                {excelRows.map((r, i) => (
                  <div key={i} className="row-list">
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.full_name || '(thiếu họ tên)'}</div>
                      <div className="muted">{r.email || '(thiếu email)'} {r.subject ? `· ${r.subject}` : ''} {r.class_names ? `· Lớp: ${r.class_names}` : ''}</div>
                    </div>
                    <span className={`tag ${r.role ? 'teal' : 'rust'}`}>{r.role === 'teacher' ? 'Giáo viên' : r.role === 'student' ? 'Học sinh' : 'Vai trò không hợp lệ'}</span>
                  </div>
                ))}
              </div>
            )}

            {excelRows.length > 0 && (
              <button onClick={handleImport} disabled={importing} style={{ marginTop: 12 }}>
                {importing ? 'Đang tạo tài khoản…' : `Nhập ${excelRows.length} tài khoản này`}
              </button>
            )}

            {importResult?.error && <div className="error" style={{ marginTop: 12 }}>{importResult.error}</div>}
            {importResult?.results && (
              <div style={{ marginTop: 14 }}>
                <div className="success">Thành công {importResult.successCount}/{importResult.total} tài khoản.</div>
                {importResult.results.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="error">{r.email}: {r.message}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'class' && (
          <>
            <div className="card">
              <h3>Tạo lớp học</h3>
              <form onSubmit={handleCreateClass}>
                <label>Tên lớp</label>
                <input value={className} onChange={e => setClassName(e.target.value)} placeholder="12A1" required />
                {classMessage && <div className={classMessage.type === 'error' ? 'error' : 'success'}>{classMessage.text}</div>}
                <button type="submit">Tạo lớp</button>
              </form>
            </div>
            <div className="card">
              <h3>Quản lý lớp ({classes.length})</h3>
              {classes.map(c => (
                <div key={c.id} className="row-list" style={{ display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b>Lớp {c.name}</b>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="ghost" onClick={() => openClassDetail(c.id)}>{openClass === c.id ? 'Đóng' : 'Quản lý'}</button>
                      <button className="ghost" onClick={() => deleteClass(c.id)}>Xóa lớp</button>
                    </div>
                  </div>
                  {openClass === c.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                      <label>Giáo viên dạy lớp ({classDetail.teachers.length})</label>
                      {classDetail.teachers.map(t => (
                        <div key={t.teacher_id + t.subject} className="row-list"><span>{t.profiles?.full_name} — {t.subject}</span><button className="ghost" onClick={() => removeTeacher(c.id, t.teacher_id, t.subject)}>Gỡ</button></div>
                      ))}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select value={pickTeacher} onChange={e => setPickTeacher(e.target.value)} style={{ marginBottom: 0 }}>
                          <option value="">— Chọn giáo viên để thêm —</option>
                          {allTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.subject})</option>)}
                        </select>
                        <button onClick={() => addTeacherToClass(c.id)}>Thêm</button>
                      </div>

                      <label style={{ marginTop: 14 }}>Học sinh ({classDetail.students.length})</label>
                      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {classDetail.students.map(s => (
                          <div key={s.student_id} className="row-list"><span>{s.profiles?.full_name}</span><button className="ghost" onClick={() => removeStudent(c.id, s.student_id)}>Bớt</button></div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <select value={pickStudent} onChange={e => setPickStudent(e.target.value)} style={{ marginBottom: 0 }}>
                          <option value="">— Học sinh chưa có lớp ({freeStudents.length}) —</option>
                          {freeStudents.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                        <button onClick={() => addStudentToClass(c.id)}>Thêm</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {classes.length === 0 && <div className="muted">Chưa có lớp nào.</div>}
            </div>
          </>
        )}

        {tab === 'overview' && (
          <>
            <h2>Kết quả các bài giáo viên đã giao — toàn trường</h2>
            <p className="muted">Chỉ xem số liệu tổng quan; nội dung tài liệu, câu hỏi của giáo viên không hiển thị với Quản trị.</p>
            <div className="card">
              {overview.map(o => (
                <div key={o.id} className="row-list">
                  <div><div style={{ fontWeight: 600 }}>{o.title}</div><div className="muted">{o.subject} · GV {o.teacher || '—'} · Lớp {o.className}</div></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="tag">{o.submitted}/{o.total} nộp</span>
                    {o.avg !== null && <span className={`tag ${Number(o.avg) >= 8 ? 'teal' : Number(o.avg) >= 5 ? 'gold' : 'rust'}`}>TB {o.avg}</span>}
                  </div>
                </div>
              ))}
              {overview.length === 0 && <div className="muted">Chưa có bài nào được giao.</div>}
            </div>
          </>
        )}

        </div>
      </div>
    </AppShell>
  );
}
