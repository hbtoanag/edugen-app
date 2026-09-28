import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const DEFAULT_PASSWORD = '12345@Edu';

async function verifyIsAdmin(accessToken) {
  const supabaseAsCaller = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

  const classCache = {};
  async function getOrCreateClass(name) {
    const key = name.trim();
    if (!key) return null;
    if (classCache[key]) return classCache[key];
    let { data: c } = await supabaseAdmin.from('classes').select('id').eq('name', key).maybeSingle();
    if (!c) { const r = await supabaseAdmin.from('classes').insert({ name: key }).select('id').single(); c = r.data; }
    classCache[key] = c?.id || null;
    return classCache[key];
  }

  const results = [];
  for (const row of rows) {
    const { full_name, email, role, subject, class_names } = row;
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
    // Xếp lớp: HS -> 1 lớp; GV -> nhiều lớp dạy (cách nhau dấu phẩy)
    const names = String(class_names || '').split(',').map(x => x.trim()).filter(Boolean);
    for (const n of (role === 'student' ? names.slice(0, 1) : names)) {
      const cid = await getOrCreateClass(n);
      if (!cid) continue;
      if (role === 'student') await supabaseAdmin.from('class_students').insert({ class_id: cid, student_id: created.user.id });
      else await supabaseAdmin.from('class_teachers').insert({ class_id: cid, teacher_id: created.user.id, subject: subject || '' });
    }
    results.push({ email, success: true, message: 'Đã tạo, mật khẩu: ' + DEFAULT_PASSWORD });
  }

  const successCount = results.filter(r => r.success).length;
  return NextResponse.json({ successCount, total: rows.length, results });
}
