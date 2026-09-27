'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import AppShell from '../../../../components/AppShell';
import QuestionKatex from '../../../../components/QuestionKatex';

const LEVEL_LABEL = { nhan_biet: 'Nhận biết', thong_hieu: 'Thông hiểu', van_dung: 'Vận dụng', van_dung_cao: 'Vận dụng cao' };
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

export default function WorksheetViewPage() {
  const params = useParams();
  const [profile, setProfile] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);

      const { data: ws } = await supabase.from('worksheets').select('*').eq('id', params.id).single();
      setWorksheet(ws);

      const { data: wq } = await supabase
        .from('worksheet_questions')
        .select('order_index, questions(*)')
        .eq('worksheet_id', params.id)
        .order('order_index');
      setQuestions((wq || []).map(r => r.questions).filter(Boolean));
      setLoading(false);
    }
    load();
  }, [params.id]);

  return (
    <AppShell profile={profile}>
      <div className="container">
        <div className="muted no-print" style={{ marginBottom: 6 }}>
          <Link href="/teacher" style={{ color: 'inherit' }}>← Quay lại Giáo viên</Link>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => setShowAnswers(s => !s)}>
            {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án (chỉ GV thấy)'}
          </button>
          <button onClick={() => window.print()}>In / Xuất PDF</button>
        </div>

        {loading && <div className="muted">Đang tải…</div>}

        {!loading && worksheet && (
          <div className="reader-page">
            <h2>{worksheet.title}</h2>
            <div style={{ textAlign: 'center', color: '#777', fontSize: 12.5, marginBottom: 26, fontFamily: 'Inter, sans-serif' }}>
              Môn {worksheet.subject} · {questions.length} câu · {worksheet.kind === 'dethi' ? 'Đề thi (AI sinh)' : 'Phiếu bài tập'}
            </div>

            {questions.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Câu {i + 1}. <QuestionKatex text={q.content_tex} />
                </div>

                {q.type === 'trac_nghiem' && q.options && (
                  <div style={{ marginLeft: 18 }}>
                    {OPTION_KEYS.map(k => q.options[k] && (
                      <div key={k} style={{ color: showAnswers && q.correct_answer === k ? 'var(--teal)' : 'inherit', fontWeight: showAnswers && q.correct_answer === k ? 700 : 400 }}>
                        {k}. <QuestionKatex text={q.options[k]} />
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'dung_sai' && q.sub_statements && (
                  <div style={{ marginLeft: 18 }}>
                    {q.sub_statements.map((s, si) => (
                      <div key={si} style={{ color: showAnswers ? (s.answer ? 'var(--teal)' : 'var(--rust)') : 'inherit' }}>
                        {s.label}) <QuestionKatex text={s.text} /> {showAnswers && (s.answer ? '(Đúng)' : '(Sai)')}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'tra_loi_ngan' && showAnswers && (
                  <div style={{ marginLeft: 18, color: 'var(--teal)' }}>Đáp số: {q.short_answer}</div>
                )}

                {showAnswers && q.solution_tex && (
                  <div style={{ marginLeft: 18, marginTop: 4, fontSize: 13, color: '#666' }}>
                    <i>Lời giải: <QuestionKatex text={q.solution_tex} /></i>
                  </div>
                )}
              </div>
            ))}
            {questions.length === 0 && <div className="muted">Phiếu này chưa có câu hỏi nào.</div>}
          </div>
        )}
      </div>
      <style jsx global>{`
        @media print {
          .appbar, .no-print { display: none !important; }
          .reader-page { box-shadow: none; }
        }
      `}</style>
    </AppShell>
  );
}
