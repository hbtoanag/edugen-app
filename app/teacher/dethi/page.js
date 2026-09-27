'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import AppShell from '../../../components/AppShell';

const LEVELS = [
  ['nhan_biet', 'Nhận biết'],
  ['thong_hieu', 'Thông hiểu'],
  ['van_dung', 'Vận dụng'],
  ['van_dung_cao', 'Vận dụng cao'],
];

export default function DeThiPage() {
  const [profile, setProfile] = useState(null);
  const [title, setTitle] = useState('');
  const [tagRows, setTagRows] = useState([]); // [{id, chapter, topic, counts: {level: available}}]
  const [inputs, setInputs] = useState({}); // key `${tagId}_${level}` -> số câu muốn lấy
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);

    const { data: questions } = await supabase
      .from('questions')
      .select('knowledge_tag_id, level')
      .eq('teacher_id', session.user.id)
      .eq('subject', prof.subject);

    const tagIds = [...new Set((questions || []).map(q => q.knowledge_tag_id).filter(Boolean))];
    if (tagIds.length === 0) { setTagRows([]); return; }

    const { data: tags } = await supabase.from('knowledge_tags').select('*').in('id', tagIds);

    const rows = (tags || []).map(tag => {
      const counts = {};
      LEVELS.forEach(([lv]) => {
        counts[lv] = (questions || []).filter(q => q.knowledge_tag_id === tag.id && q.level === lv).length;
      });
      return { id: tag.id, chapter: tag.chapter, topic: tag.topic, counts };
    });
    setTagRows(rows);
  }

  function handleInputChange(tagId, level, value) {
    setInputs(prev => ({ ...prev, [`${tagId}_${level}`]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setResult(null);
    const matrix = [];
    for (const row of tagRows) {
      for (const [lv] of LEVELS) {
        const count = Number(inputs[`${row.id}_${lv}`]) || 0;
        if (count > 0) matrix.push({ knowledge_tag_id: row.id, level: lv, count });
      }
    }
    if (matrix.length === 0) { setError('Bạn chưa chọn số câu nào trong ma trận.'); return; }
    if (!title) { setError('Bạn chưa đặt tên đề.'); return; }

    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/generate-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ title, subject: profile.subject, matrix }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(json.error); return; }
    setResult(json);
  }

  return (
    <AppShell profile={profile}>
      <div className="container">
        <div className="muted" style={{ marginBottom: 6 }}>
          <Link href="/teacher" style={{ color: 'inherit' }}>← Quay lại Giáo viên</Link>
        </div>
        <h2>Tạo đề thi theo ma trận — {profile?.subject}</h2>
        <p className="muted">Nhập số câu muốn lấy cho từng chủ đề × mức độ. Hệ thống tự chọn ngẫu nhiên từ ngân hàng câu hỏi của bạn.</p>

        {tagRows.length === 0 && (
          <div className="card muted">
            Ngân hàng câu hỏi môn {profile?.subject} của bạn chưa có câu nào được gắn nhãn kiến thức.
            Hãy tải tài liệu lên ở trang Tài liệu trước để AI trích và phân loại câu hỏi.
          </div>
        )}

        {tagRows.length > 0 && (
          <form onSubmit={handleSubmit}>
            <div className="card">
              <label>Tên đề thi</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Đề kiểm tra giữa kỳ I - Toán 12" required />
            </div>

            <div className="card" style={{ overflowX: 'auto' }}>
              <h3>Ma trận đề</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: 8 }}>Chương / Chủ đề</th>
                    {LEVELS.map(([lv, label]) => <th key={lv} style={{ padding: 8 }}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tagRows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: 8 }}>
                        <div style={{ fontWeight: 600 }}>{row.topic}</div>
                        <div className="muted">{row.chapter}</div>
                      </td>
                      {LEVELS.map(([lv]) => (
                        <td key={lv} style={{ padding: 8 }}>
                          <input
                            type="number" min="0" max={row.counts[lv]} style={{ width: 60, marginBottom: 0 }}
                            placeholder="0"
                            onChange={e => handleInputChange(row.id, lv, e.target.value)}
                          />
                          <div className="muted" style={{ fontSize: 11 }}>có {row.counts[lv]} câu</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={submitting}>{submitting ? 'Đang tạo đề…' : 'Tạo đề thi'}</button>
          </form>
        )}

        {result && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="success">Đã tạo đề với {result.totalQuestions} câu (trạng thái: Nháp — vào "Giao bài & chấm" để giao cho lớp).</div>
            {result.shortages.length > 0 && (
              <div className="error">
                Thiếu câu ở {result.shortages.length} ô ma trận (ngân hàng chưa đủ câu đúng mức độ đó) — đề vẫn tạo nhưng ít câu hơn yêu cầu ở các ô này.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
