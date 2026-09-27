'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AppShell from '../../components/AppShell';

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
    <AppShell profile={profile}>
      <div className="container">
        <h2>Chào {profile?.full_name || 'bạn'} 👋</h2>
        <p className="muted">
          Đăng nhập thành công. Màn hình Bài tập được giao / Làm bài / Kết quả sẽ hoàn thiện ở giai đoạn tiếp theo.
        </p>
      </div>
    </AppShell>
  );
}
