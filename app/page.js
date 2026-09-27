'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) {
        router.replace('/login');
        return;
      }
      if (profile.role === 'admin') router.replace('/admin');
      else if (profile.role === 'teacher') router.replace('/teacher');
      else router.replace('/student');
    }
    check();
  }, [router]);

  if (checking) return <div className="container">Đang kiểm tra đăng nhập…</div>;
  return null;
}
