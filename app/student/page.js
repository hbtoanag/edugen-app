'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AppShell from '../../components/AppShell';
import Sidebar from '../../components/Sidebar';

const heatColor = (v) => (v >= 80 ? 'var(--teal)' : v >= 60 ? 'var(--gold)' : 'var(--rust)');

export default function StudentPage() {
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [section, setSection] = useState('tongquan');
  const [className, setClassName] = useState(null);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState([]);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setEmail(session.user.email);
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);

    const res = await fetch('/api/student/assignments', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
    const json = await res.json();
    if (res.ok) { setClassName(json.className); setItems(json.items || []); }

    const { data: st } = await supabase.from('student_knowledge_stats').select('*, knowledge_tags(chapter, topic)').eq('student_id', session.user.id);
    setStats(st || []);
  }

  async function askInsight() {
    setInsightLoading(true); setInsightError('');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/ai/insight', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({}) });
    const json = await res.json();
    setInsightLoading(false);
    if (!res.ok) { setInsightError(json.error); return; }
    setInsight(json);
  }

  const pending = items.filter(i => !i.submitted);
  const done = items.filter(i => i.submitted);
  const avg = done.length ? (done.reduce((s, i) => s + Number(i.score || 0), 0) / done.length).toFixed(1) : '—';

  const navItems = [
    { id: 'tongquan', icon: '🏠', label: 'Tổng quan' },
    { id: 'baitap', icon: '📝', label: 'Bài tập được giao', badge: pending.length },
    { id: 'ketqua', icon: '📈', label: 'Kết quả & nhận xét AI', badge: done.length },
    { id: 'hoso', icon: '👤', label: 'Hồ sơ cá nhân' },
  ];
  const fmtDate = d => (d ? new Date(d).toLocaleDateString('vi-VN') : 'Không hạn');

  return (
    <AppShell profile={profile}>
      <div className="shell">
        <Sidebar items={navItems} active={section} onSelect={setSection} />
        <div className="content-area">

          {section === 'tongquan' && (
            <>
              <h2>Chào {profile?.full_name || 'bạn'} 👋</h2>
              <p className="muted">{className ? `Lớp ${className}` : 'Bạn chưa được xếp vào lớp nào — liên hệ nhà trường.'}</p>
              <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 16 }}>
                <div className="stat-card"><div className="num">{pending.length}</div><div className="lbl">Bài chưa làm</div></div>
                <div className="stat-card"><div className="num">{done.length}</div><div className="lbl">Bài đã nộp</div></div>
                <div className="stat-card"><div className="num">{avg}</div><div className="lbl">Điểm trung bình</div></div>
              </div>
              {pending.length > 0 && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h3>Cần làm ngay</h3>
                  {pending.slice(0, 3).map(i => (
                    <div key={i.id} className="row-list">
                      <div><div style={{ fontWeight: 600 }}>{i.title}</div><div className="muted">Hạn: {fmtDate(i.due_at)} · {i.duration} phút</div></div>
                      <Link href={`/student/exam/${i.id}`}><button>Làm bài</button></Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {section === 'baitap' && (
            <>
              <h2>Bài tập được giao</h2>
              <div className="card">
                {items.map(i => (
                  <div key={i.id} className="row-list">
                    <div><div style={{ fontWeight: 600 }}>{i.title}</div><div className="muted">{i.subject} · Hạn: {fmtDate(i.due_at)} · {i.duration} phút</div></div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {i.submitted ? <span className="tag teal">Đã nộp · {i.score} điểm</span> : <span className="tag gold">Chưa làm</span>}
                      <Link href={`/student/exam/${i.id}`}><button className={i.submitted ? 'ghost' : ''}>{i.submitted ? 'Xem lại' : 'Làm bài'}</button></Link>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="muted">Chưa có bài tập nào được giao.</div>}
              </div>
            </>
          )}

          {section === 'ketqua' && (
            <>
              <h2>Kết quả & nhận xét của AI</h2>
              <div className="card">
                <h3>Nhận xét của AI</h3>
                {!insight && <button className="gold" onClick={askInsight} disabled={insightLoading}>{insightLoading ? 'AI đang phân tích…' : 'Nhờ AI nhận xét kết quả của em'}</button>}
                {insightError && <div className="error" style={{ marginTop: 8 }}>{insightError}</div>}
                {insight && <div style={{ background: '#EAF4F1', border: '1px solid #cfe0d6', borderRadius: 10, padding: 14, lineHeight: 1.65 }}>{insight.message}</div>}
              </div>

              <div className="card">
                <h3>Mức độ nắm vững theo chủ đề</h3>
                {stats.length === 0 && <div className="muted">Chưa có dữ liệu — làm và nộp bài để xem.</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
                  {stats.map(s => { const v = s.trend?.slice(-1)[0] ?? 0; return (
                    <div key={s.knowledge_tag_id} style={{ background: heatColor(v), color: '#fff', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.knowledge_tags?.topic}</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{v}%</div>
                    </div>); })}
                </div>
                <div className="muted" style={{ marginTop: 10 }}>Xanh: vững (≥80%) · Vàng: tạm ổn (60–79%) · Đỏ: cần củng cố (&lt;60%)</div>
              </div>

              <div className="card">
                <h3>Các bài đã nộp</h3>
                {done.map(i => (
                  <div key={i.id} className="row-list">
                    <div>{i.title}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="tag teal">{i.score} điểm</span><Link href={`/student/exam/${i.id}`}><button className="ghost">Xem lại</button></Link></div>
                  </div>
                ))}
                {done.length === 0 && <div className="muted">Chưa nộp bài nào.</div>}
              </div>
            </>
          )}

          {section === 'hoso' && (
            <>
              <h2>Hồ sơ cá nhân</h2>
              <div className="card">
                <div className="row-list"><span className="muted">Họ và tên</span><b>{profile?.full_name}</b></div>
                <div className="row-list"><span className="muted">Email đăng nhập</span><b>{email}</b></div>
                <div className="row-list"><span className="muted">Lớp</span><b>{className || '—'}</b></div>
                <div className="row-list"><span className="muted">Điểm trung bình</span><b>{avg}</b></div>
              </div>
            </>
          )}

        </div>
      </div>
    </AppShell>
  );
}
