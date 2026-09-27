'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AppShell from '../../components/AppShell';
import Sidebar from '../../components/Sidebar';
import QuestionKatex from '../../components/QuestionKatex';

const DOC_TYPES = [
  ['de_thi_tham_khao', 'Đề thi tham khảo'],
  ['de_kiem_tra', 'Đề kiểm tra'],
  ['tai_lieu_tong_hop', 'Tài liệu tổng hợp / ôn tập'],
  ['chuyen_de', 'Chuyên đề'],
  ['khac', 'Khác'],
];
const LEVEL_LABEL = { nhan_biet: 'Nhận biết', thong_hieu: 'Thông hiểu', van_dung: 'Vận dụng', van_dung_cao: 'Vận dụng cao' };

export default function TeacherPage() {
  const [profile, setProfile] = useState(null);
  const [section, setSection] = useState('tongquan');

  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [worksheets, setWorksheets] = useState([]);
  const [classTeaching, setClassTeaching] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('tai_lieu_tong_hop');
  const [chapter, setChapter] = useState('');
  const [file, setFile] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const [bankSearch, setBankSearch] = useState('');
  const [bankLevel, setBankLevel] = useState('all');
  const [bankGroup, setBankGroup] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);

    const { data: docs } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    setDocuments(docs || []);
    const { data: qs } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    setQuestions(qs || []);
    const { data: ws } = await supabase.from('worksheets').select('*').order('created_at', { ascending: false });
    setWorksheets(ws || []);
    const { data: ct } = await supabase.from('class_teachers').select('*, classes(name)').eq('teacher_id', session.user.id);
    setClassTeaching(ct || []);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !profile) return;
    setMessage(null);
    setUploading(true);

    const filePath = `${profile.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
    if (uploadError) {
      setUploading(false);
      setMessage({ type: 'error', text: 'Lỗi tải file: ' + uploadError.message });
      return;
    }

    const { data: docRow, error: insertError } = await supabase.from('documents').insert({
      teacher_id: profile.id,
      subject: profile.subject,
      title,
      doc_type: docType,
      chapter: chapter || null,
      file_path: filePath,
      status: 'processing',
    }).select('*').single();

    if (insertError) {
      setUploading(false);
      setMessage({ type: 'error', text: insertError.message });
      return;
    }

    setMessage({ type: 'success', text: 'Đã tải lên, AI đang đọc và trích câu hỏi…' });
    setDocuments(prev => [docRow, ...prev]);
    setTitle(''); setChapter(''); setFile(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ documentId: docRow.id }),
    });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) setMessage({ type: 'error', text: 'AI trích xuất lỗi: ' + json.error });
    else setMessage({ type: 'success', text: `AI đã trích được ${json.inserted} câu hỏi.` });
    load();
  }

  async function handleDeleteQuestion(id) {
    if (!confirm('Xóa câu hỏi này khỏi ngân hàng?')) return;
    await supabase.from('questions').delete().eq('id', id);
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  async function handleDeleteWorksheet(id) {
    if (!confirm('Xóa phiếu/đề này?')) return;
    await supabase.from('worksheets').delete().eq('id', id);
    setWorksheets(prev => prev.filter(w => w.id !== id));
  }

  const filteredDocs = filterType === 'all' ? documents : documents.filter(d => d.doc_type === filterType);
  const docTypeLabel = (v) => (DOC_TYPES.find(([k]) => k === v) || [])[1] || v;

  const bankFiltered = questions.filter(q =>
    (bankLevel === 'all' || q.level === bankLevel) &&
    (bankGroup === 'all' || q.ability_group === bankGroup) &&
    (bankSearch === '' || q.content_tex.toLowerCase().includes(bankSearch.toLowerCase()))
  );

  const groupCounts = { A: questions.filter(q => q.ability_group === 'A').length, B: questions.filter(q => q.ability_group === 'B').length, C: questions.filter(q => q.ability_group === 'C').length };
  const maxGroup = Math.max(1, groupCounts.A, groupCounts.B, groupCounts.C);

  const navItems = [
    { id: 'tongquan', icon: '📊', label: 'Tổng quan' },
    { id: 'tailieu', icon: '📄', label: 'Tài liệu & AI', badge: documents.length },
    { id: 'nganhang', icon: '🗂️', label: 'Ngân hàng câu hỏi', badge: questions.length },
    { id: 'dethi', icon: '📝', label: 'Đề thi / Phiếu', badge: worksheets.length },
    { id: 'lophoc', icon: '🏫', label: 'Lớp học', badge: classTeaching.length },
  ];

  return (
    <AppShell profile={profile}>
      <div className="shell">
        <Sidebar items={navItems} active={section} onSelect={setSection} />
        <div className="content-area">

          {section === 'tongquan' && (
            <>
              <h2>Chào {profile?.full_name || 'bạn'} 👋</h2>
              <p className="muted" style={{ marginTop: -4 }}>Môn {profile?.subject}</p>
              <div className="grid-2" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 16 }}>
                <div className="stat-card"><div className="num">{documents.length}</div><div className="lbl">Tài liệu</div></div>
                <div className="stat-card"><div className="num">{questions.length}</div><div className="lbl">Câu hỏi</div></div>
                <div className="stat-card"><div className="num">{worksheets.length}</div><div className="lbl">Phiếu/Đề</div></div>
                <div className="stat-card"><div className="num">{classTeaching.length}</div><div className="lbl">Lớp dạy</div></div>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <h3>Phân bổ câu hỏi theo Nhóm năng lực</h3>
                <div className="bar-row"><span className="bar-label">Nhóm A</span><div className="bar-track"><div className="bar-fill" style={{ width: `${groupCounts.A / maxGroup * 100}%`, background: 'var(--teal)' }} /></div><span className="bar-value">{groupCounts.A}</span></div>
                <div className="bar-row"><span className="bar-label">Nhóm B</span><div className="bar-track"><div className="bar-fill" style={{ width: `${groupCounts.B / maxGroup * 100}%`, background: 'var(--gold)' }} /></div><span className="bar-value">{groupCounts.B}</span></div>
                <div className="bar-row"><span className="bar-label">Nhóm C</span><div className="bar-track"><div className="bar-fill" style={{ width: `${groupCounts.C / maxGroup * 100}%`, background: 'var(--rust)' }} /></div><span className="bar-value">{groupCounts.C}</span></div>
              </div>

              <div className="card">
                <h3>Bắt đầu nhanh</h3>
                <div className="row-list"><div style={{ fontWeight: 600 }}>Tạo phiếu bài tập (chọn tay)</div><Link href="/teacher/phieu"><button>Mở</button></Link></div>
                <div className="row-list"><div style={{ fontWeight: 600 }}>Tạo đề thi theo ma trận (AI)</div><Link href="/teacher/dethi"><button>Mở</button></Link></div>
              </div>
            </>
          )}

          {section === 'tailieu' && (
            <>
              <h2>Tài liệu & AI trích xuất</h2>
              <div className="card">
                <h3>Tải tài liệu PDF mới</h3>
                <form onSubmit={handleUpload}>
                  <div className="grid-2">
                    <div><label>Tên tài liệu</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
                    <div><label>Loại tài liệu</label>
                      <select value={docType} onChange={e => setDocType(e.target.value)}>
                        {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <label>Chương / chủ đề chính (tùy chọn)</label>
                  <input value={chapter} onChange={e => setChapter(e.target.value)} placeholder="Ví dụ: Ứng dụng đạo hàm" />
                  <label>Chọn file PDF</label>
                  <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} required />
                  {message && <div className={message.type === 'error' ? 'error' : 'success'}>{message.text}</div>}
                  <button type="submit" disabled={uploading}>{uploading ? 'Đang xử lý…' : 'Tải lên & để AI trích xuất'}</button>
                </form>
              </div>

              <div className="card">
                <h3>Tài liệu đã tải ({filteredDocs.length})</h3>
                <div className="tabs">
                  <span className={`tab-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>Tất cả</span>
                  {DOC_TYPES.map(([v, l]) => <span key={v} className={`tab-btn ${filterType === v ? 'active' : ''}`} onClick={() => setFilterType(v)}>{l}</span>)}
                </div>
                {filteredDocs.map(d => (
                  <div key={d.id} className="row-list">
                    <div><div style={{ fontWeight: 600 }}>{d.title}</div><div className="muted">{docTypeLabel(d.doc_type)}{d.chapter ? ` · ${d.chapter}` : ''}</div></div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`tag ${d.status === 'done' ? 'teal' : d.status === 'error' ? 'rust' : ''}`}>{d.status === 'done' ? 'Đã trích xuất' : d.status === 'error' ? 'Lỗi' : 'Đang xử lý…'}</span>
                      {d.status === 'done' && <Link href={`/teacher/doc/${d.id}`}><button className="ghost">Xem dạng đọc</button></Link>}
                    </div>
                  </div>
                ))}
                {filteredDocs.length === 0 && <div className="muted">Chưa có tài liệu nào.</div>}
              </div>
            </>
          )}

          {section === 'nganhang' && (
            <>
              <h2>Ngân hàng câu hỏi ({questions.length})</h2>
              <div className="card">
                <input placeholder="Tìm nội dung câu hỏi…" value={bankSearch} onChange={e => setBankSearch(e.target.value)} />
                <div className="grid-2">
                  <select value={bankLevel} onChange={e => setBankLevel(e.target.value)}>
                    <option value="all">Mức độ: Tất cả</option>
                    {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={bankGroup} onChange={e => setBankGroup(e.target.value)}>
                    <option value="all">Nhóm: Tất cả</option>
                    <option value="A">Nhóm A</option><option value="B">Nhóm B</option><option value="C">Nhóm C</option>
                  </select>
                </div>
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {bankFiltered.map(q => (
                    <div key={q.id} className="row-list" style={{ display: 'block' }}>
                      <QuestionKatex text={q.content_tex} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <div>
                          <span className="tag">{LEVEL_LABEL[q.level]}</span>{' '}
                          {q.ability_group && <span className="tag gold">Nhóm {q.ability_group}</span>}
                        </div>
                        <button className="ghost" onClick={() => handleDeleteQuestion(q.id)}>Xóa</button>
                      </div>
                    </div>
                  ))}
                  {bankFiltered.length === 0 && <div className="muted" style={{ padding: 14 }}>Không có câu nào khớp.</div>}
                </div>
              </div>
            </>
          )}

          {section === 'dethi' && (
            <>
              <h2>Đề thi / Phiếu bài tập ({worksheets.length})</h2>
              <div className="tabs">
                <Link href="/teacher/phieu"><span className="tab-btn">+ Tạo phiếu (chọn tay)</span></Link>
                <Link href="/teacher/dethi"><span className="tab-btn">+ Tạo đề thi (AI ma trận)</span></Link>
              </div>
              <div className="card">
                {worksheets.map(w => (
                  <div key={w.id} className="row-list">
                    <div><div style={{ fontWeight: 600 }}>{w.title}</div><div className="muted">{w.kind === 'dethi' ? 'Đề thi (AI sinh)' : 'Phiếu bài tập'} · {w.status === 'draft' ? 'Nháp' : w.status}</div></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link href={`/teacher/worksheet/${w.id}`}><button className="ghost">Xem</button></Link>
                      <button className="ghost" onClick={() => handleDeleteWorksheet(w.id)}>Xóa</button>
                    </div>
                  </div>
                ))}
                {worksheets.length === 0 && <div className="muted">Chưa có phiếu/đề nào.</div>}
              </div>
            </>
          )}

          {section === 'lophoc' && (
            <>
              <h2>Lớp học của bạn</h2>
              <div className="card">
                {classTeaching.map(c => (
                  <div key={c.class_id} className="row-list"><div>{c.classes?.name}</div></div>
                ))}
                {classTeaching.length === 0 && (
                  <div className="muted">Bạn chưa được phân công dạy lớp nào — liên hệ Quản trị để được gán vào lớp.</div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </AppShell>
  );
}
