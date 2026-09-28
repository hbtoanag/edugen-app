import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabaseAdmin';

// Xác định người gọi API là ai (dựa vào token đăng nhập) và lấy hồ sơ của họ.
export async function getCaller(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const asCaller = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
  return profile ? { user, profile } : null;
}

// Ngưỡng xác định "yếu": % đúng dưới mức này ở >= 2 bài gần nhất liên tiếp
export const WEAK_THRESHOLD = 60;
export function isWeak(trend) {
  const t = Array.isArray(trend) ? trend : [];
  return t.length >= 2 && t.slice(-2).every(v => v < WEAK_THRESHOLD);
}

// Chấm 1 câu: trả về { earned, max, fraction, correct }
export function gradeQuestion(q, ans) {
  if (q.type === 'trac_nghiem') {
    const ok = !!ans && String(ans).toUpperCase() === String(q.correct_answer).toUpperCase();
    return { earned: ok ? 0.25 : 0, max: 0.25, fraction: ok ? 1 : 0, correct: ok };
  }
  if (q.type === 'dung_sai') {
    const subs = Array.isArray(q.sub_statements) ? q.sub_statements : [];
    let right = 0;
    subs.forEach(s => { if (ans && typeof ans[s.label] === 'boolean' && ans[s.label] === !!s.answer) right++; });
    const table = { 0: 0, 1: 0.1, 2: 0.25, 3: 0.5, 4: 1 };
    const earned = table[Math.min(right, 4)] ?? 0;
    return { earned, max: 1, fraction: subs.length ? right / subs.length : 0, correct: right === subs.length && subs.length > 0 };
  }
  // tra_loi_ngan
  const norm = v => String(v ?? '').trim().replace(',', '.').replace(/\s+/g, '').toLowerCase();
  const ok = norm(ans) !== '' && norm(ans) === norm(q.short_answer);
  return { earned: ok ? 0.5 : 0, max: 0.5, fraction: ok ? 1 : 0, correct: ok };
}
