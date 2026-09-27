import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const DEFAULT_PASSWORD = '12345@Edu';

async function verifyIsAdmin(accessToken) {
  const supabaseAsCaller = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabaseAsCaller.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin';
}

// rows: [{ full_name, email, role: 'teacher'|'student', subject? }]
export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace('Bearer ', '');
  const isAdmin = await verifyIsAdmin(accessToken);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Chỉ Admin mới được nhập tài khoản hàng loạt.' }, { status: 403 });
  }

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Không có dòng dữ liệu nào để nhập.' }, { status: 400 });
  }

  const results = [];
  for (const row of rows) {
    const { full_name, email, role, subject } = row;
    if (!full_name || !email || !role) {
      results.push({ email: email || '(thiếu email)', success: false, message: 'Thiếu họ tên, email hoặc vai trò.' });
      continue;
    }
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });
    if (createError) {
      results.push({ email, success: false, message: createError.message });
      continue;
    }
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      full_name,
      role,
      subject: role === 'teacher' ? (subject || null) : null,
    });
    if (profileError) {
      results.push({ email, success: false, message: profileError.message });
      continue;
    }
    results.push({ email, success: true, message: 'Đã tạo, mật khẩu: ' + DEFAULT_PASSWORD });
  }

  const successCount = results.filter(r => r.success).length;
  return NextResponse.json({ successCount, total: rows.length, results });
}
