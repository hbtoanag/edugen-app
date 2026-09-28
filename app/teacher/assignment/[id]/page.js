'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import AppShell from '../../../../components/AppShell';
import QuestionKatex from '../../../../components/QuestionKatex';

const heatColor = (v) => (v >= 80 ? 'var(--teal)' : v >= 50 ? 'var(--gold)' : 'var(--rust)');

export default function AssignmentResultPage() {
  const params = useParams();
  const [profile, setProfile] = useState(null);
  const [asg, setAsg] = useState(null);
  const [rows, setRows] = useState([]);       // học sinh + điểm
  const [qStats, setQStats] = useState([]);   // từng câu: % đúng
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);

      const { data: a } = await supabase.from('assignments').select('*, worksheets(id, title), classes(name)').eq('id', params.id).single();
      setAsg(a);
      const { data: roster } = await supabase.from('class_students').select('student_id, profiles(full_name)').eq('class_id', a.class_id);
      const { data: subs } = await supabase.from('submissions').select('*').eq('assignment_id', params.id);
      const subMap = Object.fromEntries((subs || []).map(s => [s.student_id, s]));
      setRows((roster || []).map(r => ({ id: r.student_id, name: r.profiles?.full_name || '(chưa rõ tên)', sub: subMap[r.student_id] }))
        .sort((x, y) => (Number(y.sub?.score ?? -1)) - (Number(x.sub?.score ?? -1))));

      const subIds = (subs || []).filter(s => s.submitted_at).map(s => s.id);
      const { data: wq } = await supabase.from('worksheet_questions').select('order_index, questions(id, content_tex)').eq('worksheet_id', a.worksheets.id).order('order_index');
      let answers = [];
      if (subIds.length) { const r = await supabase.from('submission_answers').select('question_id, is_correct').in('submission_id', subIds); answers = r.data || []; }
      setQStats((wq || []).map((r, i) => {
        const list = answers.filter(x => x.question_id === r.questions?.id);
        const pct = list.length ? Math.round(list.filter(x => x.is_correct).length / list.length * 100) : null;
        return { no: i + 1, content: r.questions?.content_tex, pct, n: list.length };
      }));
      setLoading(false);
    }
    load();
  }, [params.id]);

  const submitted = rows.filter(r => r.sub?.submitted_at);
  const avg = submitted.length ? (submitted.reduce((s, r) => s + Number(r.sub.score || 0), 0) / submitted.length).toFixed(1) : '—';
  const hardest = [...qStats].filter(q => q.pct !== null).sort((a, b) => a.pct - b.pct).slice(0, 3);

  return (
    <AppShell profile={profile}>
      <div className="container" style={{ maxWidth: 960 }}>
        <div className="muted" style={{ marginBottom: 8 }}><Link href="/teacher" style={{ color: 'inherit' }}>← Quay lại Giáo viên</Link></div>
        {loading && <div className="muted">Đang tải…</div>}
        {!loading && asg && (
          <>
            <h2>{asg.worksheets?.title}</h2>
            <p className="muted">Lớp {asg.classes?.name} · {submitted.length}/{rows.length} đã nộp · Điểm trung bình: <b>{avg}</b></p>

            <div className="card">
              <h3>Sơ đồ nhiệt theo câu hỏi</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {qStats.map(q => (
                  <div key={q.no} title={`Câu ${q.no}: ${q.pct === null ? 'chưa có dữ liệu' : q.pct + '% đúng'}`}
                    style={{ width: 44, height: 44, borderRadius: 7, background: q.pct === null ? 'var(--line)' : heatColor(q.pct), color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                    <b>{q.no}</b><span>{q.pct === null ? '–' : q.pct + '%'}</span>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ marginTop: 10 }}>Xanh ≥80% đúng · Vàng 50–79% · Đỏ &lt;50% (cả lớp đang sai nhiều)</div>
              {hardest.length > 0 && hardest[0].pct < 50 && (
                <div style={{ marginTop: 12 }}>
                  <b>Câu cả lớp sai nhiều nhất:</b>
                  {hardest.filter(q => q.pct < 50).map(q => (
                    <div key={q.no} className="row-list"><div>Câu {q.no}: <QuestionKatex text={q.content} /></div><span className="tag rust">{q.pct}% đúng</span></div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3>Bảng điểm</h3>
              {rows.map((r, i) => (
                <div key={r.id} className="row-list">
                  <div>{i + 1}. {r.name}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {r.sub?.submitted_at ? <span className={`tag ${Number(r.sub.score) >= 8 ? 'teal' : Number(r.sub.score) >= 5 ? 'gold' : 'rust'}`}>{r.sub.score} điểm</span> : <span className="tag">Chưa nộp</span>}
                    <Link href={`/teacher/student/${r.id}`}><button className="ghost">Hồ sơ</button></Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
