'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const FEATURES = [
  ['📄', 'AI trích xuất tài liệu', 'Tải PDF đề thi/tài liệu thực tế — AI tự đọc, phân loại theo chương, mức độ, nhóm năng lực.'],
  ['🗂️', 'Ngân hàng câu hỏi', 'Lưu trữ tập trung, lọc theo môn/chương/mức độ, hỗ trợ cả trắc nghiệm, đúng-sai và trả lời ngắn.'],
  ['📝', 'Tạo đề linh hoạt', 'Giáo viên tự chọn tay từ ngân hàng, hoặc để AI tự sinh đề theo ma trận chương × mức độ.'],
  ['∑', 'Công thức chuẩn KaTeX', 'Mọi công thức Toán hiển thị đẹp như sách giáo khoa, xem được dạng trang in A4 sạch sẽ.'],
  ['🏫', 'Quản trị theo vai trò', 'Quản trị cấp tài khoản & lớp học; Giáo viên toàn quyền nội dung môn mình dạy; dữ liệu tách biệt rõ ràng.'],
  ['📥', 'Nhập liệu hàng loạt', 'Admin nhập danh sách Giáo viên/Học sinh từ Excel chỉ trong một lần thao tác.'],
];

const STEPS = ['Tải tài liệu lên', 'AI trích & phân loại câu hỏi', 'Tạo đề / phiếu bài tập', 'Giao cho lớp & theo dõi'];

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
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

  const goEnter = () => router.push(session ? roleTarget : '/login');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Thanh trên cùng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Source Serif 4',serif", fontWeight: 600, fontSize: 20, color: 'var(--navy)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gold)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>Eg</div>
          EduGen
        </div>
        {session !== undefined && (
          <button onClick={goEnter} className={session ? '' : 'ghost'}>
            {session ? 'Vào hệ thống' : 'Đăng nhập'}
          </button>
        )}
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg, var(--navy) 0%, #101a30 100%)', color: '#fff', padding: '70px 24px 90px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, padding: '5px 16px', fontSize: 12.5, marginBottom: 20 }}>
          Nền tảng dạy & học thực tế bằng AI
        </div>
        <h1 style={{ color: '#fff', fontSize: 40, lineHeight: 1.25, maxWidth: 640, margin: '0 auto 16px' }}>
          Từ tài liệu thật đến đề thi chuẩn — chỉ trong vài phút
        </h1>
        <p style={{ color: 'rgba(255,255,255,.78)', fontSize: 16, maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.7 }}>
          Giáo viên tải tài liệu, AI tự trích và phân loại câu hỏi, tạo đề theo ma trận; Học sinh làm bài và nhận định hướng ôn tập — mọi công thức Toán hiển thị đẹp như sách in.
        </p>
        <button onClick={goEnter} className="gold" style={{ padding: '13px 34px', fontSize: 15, borderRadius: 999 }}>
          {session ? 'Vào hệ thống' : 'Đăng nhập ngay'}
        </button>
      </div>

      {/* Quy trình 4 bước */}
      <div style={{ maxWidth: 1000, margin: '-46px auto 0', padding: '0 20px' }}>
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, padding: 24 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tính năng */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '56px 20px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 6 }}>Đầy đủ những gì một trường học cần</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 32 }}>Ba vai trò riêng biệt — Quản trị, Giáo viên, Học sinh — mỗi người chỉ thấy đúng phần việc của mình.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="card">
              <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
              <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '20px 16px 34px', color: 'var(--muted)', fontSize: 12.5 }}>
        Tài khoản do quản trị nhà trường cấp — hệ thống không tự đăng ký công khai.
      </div>

      <style jsx global>{`
        @media (max-width: 700px) {
          div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
