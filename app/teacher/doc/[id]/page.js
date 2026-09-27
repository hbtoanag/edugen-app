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
