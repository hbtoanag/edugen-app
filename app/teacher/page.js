'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AppShell from '../../components/AppShell';
import QuestionKatex from '../../components/QuestionKatex';

const DOC_TYPES = [
  ['de_thi_tham_khao', 'Đề thi tham khảo'],
  ['de_kiem_tra', 'Đề kiểm tra'],
  ['tai_lieu_tong_hop', 'Tài liệu tổng hợp / ôn tập'],
  ['chuyen_de', 'Chuyên đề'],
  ['khac', 'Khác'],
];

export default function TeacherPage() {
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('tai_lieu_tong_hop');
  const [chapter, setChapter] = useState('');
  const [file, setFile] = useState(null);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);
    const { data: docs } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    setDocuments(docs || []);
    const { data: qs } = await supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(10);
    setQuestions(qs || []);
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
    if (!res.ok) {
      setMessage({ type: 'error', text: 'AI trích xuất lỗi: ' + json.error });
    } else {
      setMessage({ type: 'success', text: `AI đã trích được ${json.inserted} câu hỏi.` });
    }
    load();
  }

  const filteredDocs = filterType === 'all' ? documents : documents.filter(d => d.doc_type === filterType);
  const docTypeLabel = (v) => (DOC_TYPES.find(([k]) => k === v) || [])[1] || v;

  return (
    <AppShell profile={profile}>
      <div className="container">
        <h2>Chào {profile?.full_name || 'bạn'} 👋</h2>
        <p className="muted" style={{ marginTop: -4 }}>Môn {profile?.subject}</p>

        <div className="card">
          <h3>Chức năng của bạn</h3>
          <div className="row-list">
            <div>
              <div style={{ fontWeight: 600 }}>Tài liệu & AI trích xuất</div>
              <div className="muted">Tải PDF lên, AI tự trích câu hỏi vào ngân hàng — xem ngay bên dưới trang này.</div>
            </div>
            <span className="tag teal">Đang xem</span>
          </div>
          <div className="row-list">
            <div>
              <div style={{ fontWeight: 600 }}>Tạo đề thi theo ma trận (AI)</div>
              <div className="muted">Nhập số câu theo chủ đề × mức độ, hệ thống tự chọn câu từ ngân hàng của bạn.</div>
            </div>
            <Link href="/teacher/dethi"><button>Mở</button></Link>
          </div>
        </div>
        <div className="card">
          <h3>Tải tài liệu PDF mới</h3>
          <form onSubmit={handleUpload}>
            <div className="grid-2">
              <div>
                <label>Tên tài liệu</label>
                <input value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div>
                <label>Loại tài liệu</label>
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
            {DOC_TYPES.map(([v, l]) => (
              <span key={v} className={`tab-btn ${filterType === v ? 'active' : ''}`} onClick={() => setFilterType(v)}>{l}</span>
            ))}
          </div>
          {filteredDocs.map(d => (
            <div key={d.id} className="row-list">
              <div>
                <div style={{ fontWeight: 600 }}>{d.title}</div>
                <div className="muted">{docTypeLabel(d.doc_type)}{d.chapter ? ` · ${d.chapter}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`tag ${d.status === 'done' ? 'teal' : d.status === 'error' ? 'rust' : ''}`}>
                  {d.status === 'done' ? 'Đã trích xuất' : d.status === 'error' ? 'Lỗi' : 'Đang xử lý…'}
                </span>
                {d.status === 'done' && <Link href={`/teacher/doc/${d.id}`}><button className="ghost">Xem dạng đọc</button></Link>}
              </div>
            </div>
          ))}
          {filteredDocs.length === 0 && <div className="muted">Chưa có tài liệu nào.</div>}
        </div>

        <div className="card">
          <h3>Câu hỏi mới trích được (10 câu gần nhất)</h3>
          {questions.map(q => (
            <div key={q.id} className="row-list" style={{ display: 'block' }}>
              <QuestionKatex text={q.content_tex} />
              {q.options && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {Object.entries(q.options).map(([k, v]) => (
                    <div key={k}>{k}. <QuestionKatex text={v} /></div>
                  ))}
                </div>
              )}
              <div className="muted" style={{ marginTop: 6 }}>Mức độ: {q.level} · Nhóm: {q.ability_group || '—'}</div>
            </div>
          ))}
          {questions.length === 0 && <div className="muted">Chưa có câu hỏi nào.</div>}
        </div>
      </div>
    </AppShell>
  );
}
