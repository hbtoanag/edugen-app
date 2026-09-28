'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import AppShell from '../../../../components/AppShell';

const heatColor = (v) => (v >= 80 ? 'var(--teal)' : v >= 60 ? 'var(--gold)' : 'var(--rust)');
const isWeak = (t) => Array.isArray(t) && t.length >= 2 && t.slice(-2).every(v => v < 60);

export default function StudentProfilePage() {
  const params = useParams();
  const [profile, setProfile] = useState(null);
  const [student, setStudent] = useState(null);
  const [stats, setStats] = useState([]);
  const [insight, setInsight] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
      const { data: st } = await supabase.from('profiles').select('id, full_name').eq('id', params.id).single();
      setStudent(st);
      const { data: ks } = await supabase.from('student_knowledge_stats').select('*, knowledge_tags(chapter, topic)').eq('student_id', params.id);
      setStats(ks || []);
    }
    load();
  }, [params.id]);

  async function call(url, body, key) {
    const { data: { session } } = await supabase.auth.getSession();
    setBusy(key); setMsg(null);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy('');
    if (!res.ok) { setMsg({ type: 'error', text: json.error }); return null; }
    return json;
  }

  async function getInsight() { const j = await call('/api/ai/insight', { studentId: params.id }, 'insight'); if (j) setInsight(j); }
  async function makeReview() {
    const j = await call('/api/ai/review-worksheet', { studentId: params.id }, 'review');
    if (j) setMsg({ type: 'success', text: `Đã tạo NHÁP phiếu ôn tập riêng (${j.total} câu). Vào "Đề thi / Phiếu" để duyệt rồi giao.` });
  }

  const weak = stats.filter(s => isWeak(s.trend));

  return (
    <AppShell profile={profile}>
      <div className="container">
        <div className="muted" style={{ marginBottom: 8 }}><Link href="/teacher" style={{ color: 'inherit' }}>← Quay lại Giáo viên</Link></div>
        <h2>Hồ sơ học sinh: {student?.full_name}</h2>
        <p className="muted">Chủ đề bị coi là "yếu" khi sai (&lt;60%) liên tiếp ở 2 bài gần nhất.</p>

        <div className="card">
          <h3>Sơ đồ nhiệt kiến thức</h3>
          {stats.length === 0 && <div className="muted">Học sinh chưa nộp bài nào nên chưa có dữ liệu.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
            {stats.map(s => { const v = s.trend?.slice(-1)[0] ?? 0; return (
              <div key={s.knowledge_tag_id} style={{ background: heatColor(v), color: '#fff', borderRadius: 8, padding: '10px 12px', outline: isWeak(s.trend) ? '3px solid #000' : 'none' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.knowledge_tags?.topic}</div>
                <div style={{ fontSize: 11, opacity: .85 }}>{s.knowledge_tags?.chapter}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{v}%</div>
                <div style={{ fontSize: 11 }}>{(s.trend || []).join(' → ')}</div>
              </div>); })}
          </div>
          {weak.length > 0 && <div className="error" style={{ marginTop: 10 }}>Đang yếu: {weak.map(w => w.knowledge_tags?.topic).join(', ')} (viền đen)</div>}
        </div>

        <div className="card">
          <h3>Nhận định của AI & hành động</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="gold" onClick={getInsight} disabled={!!busy}>{busy === 'insight' ? 'AI đang phân tích…' : 'AI nhận định học sinh'}</button>
            <button onClick={makeReview} disabled={!!busy}>{busy === 'review' ? 'Đang tạo…' : 'Tạo phiếu ôn tập riêng (chờ duyệt)'}</button>
          </div>
          {msg && <div className={msg.type === 'error' ? 'error' : 'success'} style={{ marginTop: 10 }}>{msg.text}</div>}
          {insight && <div style={{ marginTop: 12, background: '#EAF4F1', border: '1px solid #cfe0d6', borderRadius: 10, padding: 14, lineHeight: 1.65 }}>{insight.message}</div>}
        </div>
      </div>
    </AppShell>
  );
}
