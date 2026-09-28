'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import AppShell from '../../../../components/AppShell';
import QuestionKatex from '../../../../components/QuestionKatex';

const KEYS = ['A', 'B', 'C', 'D'];

export default function ExamPage() {
  const params = useParams();
  const [profile, setProfile] = useState(null);
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const answersRef = useRef({});
  const doneRef = useRef(false);

  useEffect(() => { load(); }, []);

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
  }

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);
    const res = await fetch('/api/student/exam', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ assignmentId: params.id }) });
    const json = await res.json();
    if (!res.ok) { setError(json.error); return; }
    setExam(json);
    if (!json.submitted && json.duration) setSecondsLeft(json.duration * 60);
  }

  useEffect(() => {
    if (secondsLeft === null || exam?.submitted) return;
    if (secondsLeft <= 0) { submit(true); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, exam]);

  function setAnswer(qid, value) {
    setAnswers(prev => { const n = { ...prev, [qid]: value }; answersRef.current = n; return n; });
  }

  async function submit(auto = false) {
    if (doneRef.current) return;
    if (!auto && !confirm('Nộp bài? Sau khi nộp bạn không thể sửa.')) return;
    doneRef.current = true; setSubmitting(true);
    const res = await fetch('/api/student/submit', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ assignmentId: params.id, answers: answersRef.current }) });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) { doneRef.current = false; setError(json.error); return; }
    setSecondsLeft(null);
    load();
  }

  const mm = secondsLeft !== null ? String(Math.floor(secondsLeft / 60)).padStart(2, '0') : '';
  const ss = secondsLeft !== null ? String(secondsLeft % 60).padStart(2, '0') : '';

  return (
    <AppShell profile={profile}>
      <div className="container">
        <div className="muted" style={{ marginBottom: 8 }}><Link href="/student" style={{ color: 'inherit' }}>← Quay lại</Link></div>
        {error && <div className="error">{error}</div>}
        {!exam && !error && <div className="muted">Đang tải đề…</div>}

        {exam && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, position: 'sticky', top: 0, background: 'var(--bg)', padding: '8px 0', zIndex: 5 }}>
              <div>
                <h2 style={{ margin: 0 }}>{exam.title}</h2>
                <div className="muted">{exam.questions.length} câu{exam.submitted ? ` · Điểm: ${exam.score}/10` : ''}</div>
              </div>
              {!exam.submitted && secondsLeft !== null && (
                <span className={`tag ${secondsLeft < 300 ? 'rust' : 'gold'}`} style={{ fontSize: 15, padding: '6px 14px' }}>⏱ {mm}:{ss}</span>
              )}
            </div>

            <div className="reader-page" style={{ maxWidth: '100%', padding: '34px 36px' }}>
              {exam.questions.map((q, i) => (
                <div key={q.id} style={{ marginBottom: 22 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Câu {i + 1}. <QuestionKatex text={q.content_tex} />
                    {exam.submitted && <span className={`tag ${q.is_correct ? 'teal' : 'rust'}`} style={{ marginLeft: 8 }}>{q.is_correct ? 'Đúng' : 'Chưa đúng'}</span>}
                  </div>

                  {q.type === 'trac_nghiem' && q.options && KEYS.map(k => q.options[k] && (
                    <label key={k} style={{ display: 'flex', gap: 8, marginLeft: 14, marginBottom: 4, cursor: exam.submitted ? 'default' : 'pointer',
                      color: exam.submitted && q.correct_answer === k ? 'var(--teal)' : 'inherit', fontWeight: exam.submitted && q.correct_answer === k ? 700 : 400 }}>
                      <input type="radio" name={q.id} disabled={exam.submitted}
                        checked={(exam.submitted ? q.my_answer : answers[q.id]) === k}
                        onChange={() => setAnswer(q.id, k)} style={{ width: 'auto', margin: 0 }} />
                      <span>{k}. <QuestionKatex text={q.options[k]} /></span>
                    </label>
                  ))}

                  {q.type === 'dung_sai' && (q.sub_statements || []).map(s => {
                    const mine = exam.submitted ? q.my_answer?.[s.label] : answers[q.id]?.[s.label];
                    return (
                      <div key={s.label} style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 14, marginBottom: 4 }}>
                        <span style={{ flex: 1 }}>{s.label}) <QuestionKatex text={s.text} />
                          {exam.submitted && <i style={{ color: 'var(--muted)' }}> — đáp án: {s.answer ? 'Đúng' : 'Sai'}</i>}</span>
                        {['Đúng', 'Sai'].map((lbl, bi) => (
                          <label key={lbl} style={{ display: 'flex', gap: 4, alignItems: 'center', margin: 0 }}>
                            <input type="radio" name={`${q.id}_${s.label}`} disabled={exam.submitted} style={{ width: 'auto', margin: 0 }}
                              checked={mine === (bi === 0)}
                              onChange={() => setAnswer(q.id, { ...(answers[q.id] || {}), [s.label]: bi === 0 })} />{lbl}
                          </label>
                        ))}
                      </div>
                    );
                  })}

                  {q.type === 'tra_loi_ngan' && (
                    <div style={{ marginLeft: 14, maxWidth: 260 }}>
                      <input placeholder="Nhập đáp số" disabled={exam.submitted} value={(exam.submitted ? q.my_answer : answers[q.id]) ?? ''} onChange={e => setAnswer(q.id, e.target.value)} />
                      {exam.submitted && <div style={{ color: 'var(--teal)', fontWeight: 600 }}>Đáp số đúng: {q.short_answer}</div>}
                    </div>
                  )}

                  {exam.submitted && q.solution_tex && (
                    <div style={{ marginLeft: 14, marginTop: 4, fontSize: 13.5, color: '#555' }}><i>Lời giải: <QuestionKatex text={q.solution_tex} /></i></div>
                  )}
                </div>
              ))}
            </div>

            {!exam.submitted && <button onClick={() => submit(false)} disabled={submitting} style={{ marginTop: 16 }}>{submitting ? 'Đang chấm…' : 'Nộp bài'}</button>}
          </>
        )}
      </div>
    </AppShell>
  );
}
