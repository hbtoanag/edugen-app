'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được cấp.');
      return;
    }
    router.replace('/');
  }

  return (
    <div className="container narrow" style={{ paddingTop: 90 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--gold)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 10px' }}>Eg</div>
        <h2 style={{ marginBottom: 2 }}>Đăng nhập EduGen</h2>
        <p className="muted">Tài khoản do quản trị trường cấp qua email.</p>
      </div>
      <form onSubmit={handleLogin}>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Mật khẩu</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
