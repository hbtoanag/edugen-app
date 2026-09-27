'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import QuestionKatex from '../../components/QuestionKatex';

export default function TeacherPage() {
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);
    const { data: docs } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    setDocuments(docs || []);
    const { data: qs } = await supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(20);
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
    setTitle(''); setFile(null);

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

  return (
    <div className="container">
      <h2>Tài liệu & AI trích xuất — {profile?.subject}</h2>

      <div className="card">
        <h3>Tải tài liệu PDF mới</h3>
        <form onSubmit={handleUpload}>
          <label>Tên tài liệu</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required />
          <label>Chọn file PDF</label>
          <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} required />
          {message && <div className={message.type === 'error' ? 'error' : 'muted'}>{message.text}</div>}
          <button type="submit" disabled={uploading}>{uploading ? 'Đang xử lý…' : 'Tải lên & để AI trích xuất'}</button>
        </form>
      </div>

      <div className="card">
        <h3>Tài liệu đã tải</h3>
        {documents.map(d => (
          <div key={d.id} className="muted" style={{ marginBottom: 6 }}>
            • {d.title} — {d.status === 'done' ? 'Đã trích xuất' : d.status === 'error' ? 'Lỗi' : 'Đang xử lý…'}
          </div>
        ))}
        {documents.length === 0 && <div className="muted">Chưa có tài liệu nào.</div>}
      </div>

      <div className="card">
        <h3>Câu hỏi mới trích được (20 câu gần nhất)</h3>
        {questions.map(q => (
          <div key={q.id} className="card" style={{ background: '#FAFAF8' }}>
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
  );
}
