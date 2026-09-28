'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import AppShell from '../../../../components/AppShell';
import QuestionKatex from '../../../../components/QuestionKatex';

export default function DocReaderPage() {
  const params = useParams();
  const [profile, setProfile] = useState(null);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [sumError, setSumError] = useState('');

  async function summarize() {
    setSummarizing(true); setSumError('');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/ai/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ documentId: params.id }) });
    const json = await res.json();
    setSummarizing(false);
    if (!res.ok) { setSumError(json.error); return; }
    setDoc(d => ({ ...d, ai_summary: json.summary }));
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
      const { data } = await supabase.from('documents').select('*').eq('id', params.id).single();
      setDoc(data);
      setLoading(false);
    }
    load();
  }, [params.id]);

  return (
    <AppShell profile={profile}>
      <div className="container">
        <div className="muted" style={{ marginBottom: 12 }}>
          <Link href="/teacher" style={{ color: 'inherit' }}>← Quay lại Tài liệu</Link>
        </div>

        {loading && <div className="muted">Đang tải…</div>}

        {!loading && doc && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>Tóm tắt kiến thức bằng AI</h3>
              <button className="gold" onClick={summarize} disabled={summarizing}>{summarizing ? 'AI đang tóm tắt…' : doc.ai_summary ? 'Tóm tắt lại' : 'Tóm tắt bằng AI'}</button>
            </div>
            {sumError && <div className="error" style={{ marginTop: 8 }}>{sumError}</div>}
            {doc.ai_summary && (
              <div style={{ marginTop: 12, lineHeight: 1.65 }}>
                <b>Chủ đề chính</b>
                <ul>{(doc.ai_summary.main_topics || []).map((t, i) => <li key={i}><QuestionKatex text={t} /></li>)}</ul>
                <b>Công thức trọng tâm</b>
                <ul>{(doc.ai_summary.key_formulas || []).map((t, i) => <li key={i}><QuestionKatex text={t} /></li>)}</ul>
                <b>Kiến thức cần nhớ</b>
                <ul>{(doc.ai_summary.must_remember || []).map((t, i) => <li key={i}><QuestionKatex text={t} /></li>)}</ul>
                <b>Gợi ý phân hóa</b>
                <ul>{Object.entries(doc.ai_summary.differentiation || {}).map(([k, v]) => <li key={k}>Nhóm {k}: <QuestionKatex text={String(v)} /></li>)}</ul>
              </div>
            )}
          </div>
        )}

        {!loading && doc && !doc.clean_reading_content && (
          <div className="card muted">
            Tài liệu này chưa có bản đọc sạch (có thể AI chưa xử lý xong, hoặc tài liệu được tải lên trước khi có tính năng này — thử tải lại tài liệu để AI tạo bản đọc).
          </div>
        )}

        {!loading && doc?.clean_reading_content && (
          <div className="reader-page">
            <h2>{doc.title}</h2>
            <div style={{ textAlign: 'center', color: '#777', fontSize: 12.5, marginBottom: 22, fontFamily: 'Inter, sans-serif' }}>
              Môn {doc.subject}{doc.chapter ? ` · ${doc.chapter}` : ''}
            </div>
            {doc.clean_reading_content.split('\n').map((line, i) => (
              line.trim() === ''
                ? <div key={i} style={{ height: 10 }} />
                : <p key={i} style={{ margin: '0 0 10px' }}><QuestionKatex text={line} /></p>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
