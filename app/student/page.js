'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function StudentPage() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
    }
    load();
  }, []);

  return (
    <div className="container">
      <h2>Chào {profile?.full_name || 'bạn'} 👋</h2>
      <p className="muted">
        Đăng nhập thành công. Màn hình Bài tập được giao / Làm bài / Kết quả sẽ hoàn thiện ở giai đoạn 2.
      </p>
    </div>
  );
}
