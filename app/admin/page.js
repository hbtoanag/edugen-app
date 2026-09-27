'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminPage() {
  const [role, setRole] = useState('teacher');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [className, setClassName] = useState('');
  const [classMessage, setClassMessage] = useState(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => { loadClasses(); }, []);

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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, fullName, role, subject }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage({ type: 'error', text: json.error });
      return;
    }
    setMessage({
      type: 'success',
      text: `Đã tạo tài khoản ${email}. Mật khẩu tạm: ${json.tempPassword} — gửi cho ${role === 'teacher' ? 'giáo viên' : 'học sinh'} để đăng nhập lần đầu.`,
    });
    setEmail(''); setFullName(''); setSubject('');
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
    <div className="container">
      <h2>Bảng điều khiển Admin</h2>

      <div className="card">
        <h3>Tạo tài khoản Giáo viên / Học sinh</h3>
        <form onSubmit={handleCreateUser}>
          <label>Vai trò</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="teacher">Giáo viên</option>
            <option value="student">Học sinh</option>
          </select>
          <label>Họ và tên</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} required />
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {role === 'teacher' && (
            <>
              <label>Môn dạy</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Toán, Lý, Hóa..." required />
            </>
          )}
          {message && <div className={message.type === 'error' ? 'error' : 'muted'}>{message.text}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
        </form>
      </div>

      <div className="card">
        <h3>Tạo lớp học</h3>
        <form onSubmit={handleCreateClass}>
          <label>Tên lớp</label>
          <input value={className} onChange={e => setClassName(e.target.value)} placeholder="12A1" required />
          {classMessage && <div className={classMessage.type === 'error' ? 'error' : 'muted'}>{classMessage.text}</div>}
          <button type="submit">Tạo lớp</button>
        </form>
        <div style={{ marginTop: 12 }}>
          {classes.map(c => <div key={c.id} className="muted">• {c.name}</div>)}
        </div>
      </div>

      <p className="muted">Phần gán học sinh vào lớp và phân công giáo viên dạy lớp sẽ hoàn thiện ở giai đoạn 2.</p>
    </div>
  );
}
