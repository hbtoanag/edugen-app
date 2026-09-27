'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import AppShell from '../../../components/AppShell';
import QuestionKatex from '../../../components/QuestionKatex';

const LEVEL_LABEL = { nhan_biet: 'Nhận biết', thong_hieu: 'Thông hiểu', van_dung: 'Vận dụng', van_dung_cao: 'Vận dụng cao' };

export default function PhieuPage() {
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [docFilter, setDocFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [myWorksheets, setMyWorksheets] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);

    const { data: docs } = await supabase.from('documents').select('id, title').eq('teacher_id', session.user.id).eq('status', 'done');
    setDocuments(docs || []);

    const { data: qs } = await supabase.from('questions').select('*').eq('teacher_id', session.user.id).order('created_at', { ascending: false });
    setQuestions(qs || []);

    const { data: ws } = await supabase.from('worksheets').select('*').eq('teacher_id', session.user.id).eq('kind', 'phieu').order('created_at', { ascending: false });
    setMyWorksheets(ws || []);
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function quickSelectGroup(group) {
    const ids = filtered.filter(q => q.ability_group === group).map(q => q.id);
    setSelected(prev => [...new Set([...prev, ...ids])]);
  }

  const filtered = questions.filter(q =>
    (docFilter === 'all' || q.document_id === docFilter) &&
    (levelFilter === 'all' || q.level === levelFilter) &&
    (groupFilter === 'all' || q.ability_group === groupFilter)
  );

  async function handleCreate() {
    setMessage(null);
    if (!title) { setMessage({ type: 'error', text: 'Bạn chưa đặt tên phiếu.' }); return; }
    if (selected.length === 0) { setMessage({ type: 'error', text: 'Bạn chưa chọn câu nào.' }); return; }

    setSaving(true);
    const { data: ws, error: wsError } = await supabase.from('worksheets').insert({
      teacher_id: profile.id,
      subject: profile.subject,
      title,
      kind: 'phieu',
      status: 'draft',
    }).select('*').single();

    if (wsError) { setSaving(false); setMessage({ type: 'error', text: wsError.message }); return; }

    const rows = selected.map((qid, i) => ({ worksheet_id: ws.id, question_id: qid, order_index: i }));
    const { error: wqError } = await supabase.from('worksheet_questions').insert(rows);
    setSaving(false);
    if (wqError) { setMessage({ type: 'error', text: wqError.message }); return; }

    setMessage({ type: 'success', text: `Đã tạo phiếu "${title}" với ${selected.length} câu.` });
    setTitle(''); setSelected([]);
    load();
  }

  return (
    <AppShell profile={profile}>
      <div className="container">
        <div className="muted" style={{ marginBottom: 6 }}>
          <Link href="/teacher" style={{ color: 'inherit' }}>← Quay lại Giáo viên</Link>
        </div>
        <h2>Tạo phiếu bài tập (chọn tay) — {profile?.subject}</h2>
        <p className="muted">Lọc và tick chọn câu từ ngân hàng của bạn, đặt tên phiếu rồi tạo.</p>

        <div className="card">
          <label>Tên phiếu</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Phiếu ôn tập — Ứng dụng đạo hàm" />

          <div className="grid-2">
            <div>
              <label>Lọc theo tài liệu nguồn</label>
              <select value={docFilter} onChange={e => setDocFilter(e.target.value)}>
                <option value="all">Tất cả tài liệu</option>
                {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div>
              <label>Lọc theo mức độ</label>
              <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                <option value="all">Tất cả mức độ</option>
                {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="tabs">
            <span className="muted" style={{ alignSelf: 'center' }}>Chọn nhanh:</span>
            <span className="tab-btn" onClick={() => quickSelectGroup('A')}>Nhóm A</span>
            <span className="tab-btn" onClick={() => quickSelectGroup('B')}>Nhóm B</span>
            <span className="tab-btn" onClick={() => quickSelectGroup('C')}>Nhóm C</span>
            <span className="tab-btn" onClick={() => setSelected([])}>Bỏ chọn hết</span>
            <span className="muted" style={{ alignSelf: 'center' }}>Đã chọn {selected.length} câu</span>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            {filtered.map(q => (
              <label key={q.id} className="row-list" style={{ display: 'flex', alignItems: 'flex-start', margin: 0, borderRadius: 0, borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggleSelect(q.id)} style={{ width: 'auto', marginTop: 3, marginRight: 10, marginBottom: 0 }} />
                <div style={{ flex: 1 }}>
                  <QuestionKatex text={q.content_tex} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <span className="tag">{LEVEL_LABEL[q.level]}</span>
                  {q.ability_group && <span className="tag gold">Nhóm {q.ability_group}</span>}
                </div>
              </label>
            ))}
            {filtered.length === 0 && <div className="muted" style={{ padding: 14 }}>Không có câu nào khớp bộ lọc.</div>}
          </div>

          {message && <div className={message.type === 'error' ? 'error' : 'success'} style={{ marginTop: 12 }}>{message.text}</div>}
          <button onClick={handleCreate} disabled={saving} style={{ marginTop: 12 }}>{saving ? 'Đang tạo…' : 'Tạo phiếu'}</button>
        </div>

        <div className="card">
          <h3>Phiếu đã tạo</h3>
          {myWorksheets.map(w => (
            <div key={w.id} className="row-list">
              <div>{w.title}</div>
              <Link href={`/teacher/worksheet/${w.id}`}><button className="ghost">Xem dạng trang</button></Link>
            </div>
          ))}
          {myWorksheets.length === 0 && <div className="muted">Chưa có phiếu nào.</div>}
        </div>
      </div>
    </AppShell>
  );
}
