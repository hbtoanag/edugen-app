'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const ROLE_LABEL = { admin: 'Quản trị', teacher: 'Giáo viên', student: 'Học sinh' };

export default function AppShell({ profile, children }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <>
      <div className="appbar">
        <div className="brand">
          <div className="brand-mark">Eg</div>EduGen
        </div>
        <div className="user-block">
          {profile && (
            <>
              <span className="role-badge">{ROLE_LABEL[profile.role] || profile.role}</span>
              <span className="user-name">{profile.full_name}</span>
            </>
          )}
          <button className="logout" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </div>
      {children}
    </>
  );
}
