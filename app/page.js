'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = đang kiểm tra, null = chưa đăng nhập
  const [roleTarget, setRoleTarget] = useState('/login');

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile?.role === 'admin') setRoleTarget('/admin');
        else if (profile?.role === 'teacher') setRoleTarget('/teacher');
        else if (profile?.role === 'student') setRoleTarget('/student');
      }
    }
    check();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, var(--navy) 0%, #101a30 100%)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--gold)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, marginBottom: 18 }}>Eg</div>
        <h1 style={{ color: '#fff', fontSize: 34, marginBottom: 10 }}>EduGen</h1>
        <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 16, maxWidth: 480, marginBottom: 30, lineHeight: 1.6 }}>
          Nền tảng dạy & học thực tế bằng AI — Giáo viên tải tài liệu, AI tự trích câu hỏi, tạo đề thi và giao bài; Học sinh làm bài và nhận định hướng ôn tập cá nhân hóa.
        </p>

        {session === undefined && <div style={{ color: 'rgba(255,255,255,.6)' }}>Đang kiểm tra đăng nhập…</div>}

        {session !== undefined && (
          <button
            onClick={() => router.push(session ? roleTarget : '/login')}
            style={{ background: 'var(--gold)', color: 'var(--navy)', padding: '13px 34px', fontSize: 15, borderRadius: 999, fontWeight: 700 }}
          >
            {session ? 'Vào hệ thống' : 'Đăng nhập'}
          </button>
        )}

        <div style={{ display: 'flex', gap: 28, marginTop: 46, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            ['📄', 'AI trích xuất tài liệu'],
            ['🗂️', 'Ngân hàng câu hỏi'],
            ['📝', 'Tạo đề theo ma trận'],
            ['📊', 'Thống kê & định hướng ôn tập'],
          ].map(([icon, label]) => (
            <div key={label} style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, maxWidth: 120 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>{label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: 16, color: 'rgba(255,255,255,.4)', fontSize: 12 }}>
        Tài khoản do quản trị trường cấp — không tự đăng ký.
      </div>
    </div>
  );
}
