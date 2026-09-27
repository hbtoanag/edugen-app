'use client';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import AppShell from '../../components/AppShell';
import Sidebar from '../../components/Sidebar';

function downloadTemplate() {
  const wsData = [
    ['Họ và tên', 'Email', 'Vai trò', 'Môn dạy (chỉ điền nếu là Giáo viên)'],
    ['Nguyễn Văn A', 'nguyenvana@example.com', 'Giáo viên', 'Toán'],
    ['Trần Thị B', 'tranthib@example.com', 'Học sinh', ''],
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
        return { full_name: String(full_name).trim(), email: String(email).trim(), role: normalizeRole(roleRaw), subject: String(subjectRaw).trim() };
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
          ]}
          active={tab}
          onSelect={setTab}
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
                      <div className="muted">{r.email || '(thiếu email)'} {r.subject ? `· ${r.subject}` : ''}</div>
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
          <div className="card">
            <h3>Tạo lớp học</h3>
            <form onSubmit={handleCreateClass}>
              <label>Tên lớp</label>
              <input value={className} onChange={e => setClassName(e.target.value)} placeholder="12A1" required />
              {classMessage && <div className={classMessage.type === 'error' ? 'error' : 'success'}>{classMessage.text}</div>}
              <button type="submit">Tạo lớp</button>
            </form>
            <div style={{ marginTop: 12 }}>
              {classes.map(c => <div key={c.id} className="row-list"><span>{c.name}</span></div>)}
            </div>
            <p className="muted">Phần gán học sinh vào lớp và phân công giáo viên dạy lớp sẽ hoàn thiện ở giai đoạn tiếp theo.</p>
          </div>
        )}

        </div>
      </div>
    </AppShell>
  );
}
