import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Xác thực người gọi API này thực sự là Admin, dựa trên token đăng nhập họ gửi lên.
async function verifyIsAdmin(accessToken) {
  const supabaseAsCaller = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabaseAsCaller.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return profile?.role === 'admin';
}

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace('Bearer ', '');

  const isAdmin = await verifyIsAdmin(accessToken);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Chỉ Admin mới được tạo tài khoản.' }, { status: 403 });
  }

  const { email, fullName, role, subject } = await req.json();
  if (!email || !fullName || !role) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc.' }, { status: 400 });
  }

  // Tạo mật khẩu tạm ngẫu nhiên — GV/HS sẽ đổi mật khẩu ở lần đăng nhập đầu (làm ở giai đoạn sau).
  const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    role,
    subject: role === 'teacher' ? subject : null,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, tempPassword, userId: created.user.id });
}
