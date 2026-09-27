import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace('Bearer ', '');

  const supabaseAsCaller = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabaseAsCaller.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

  const { title, subject, matrix } = await req.json();
  // matrix: [{ knowledge_tag_id, level, count }]
  if (!title || !subject || !Array.isArray(matrix) || matrix.length === 0) {
    return NextResponse.json({ error: 'Thiếu tên đề, môn học hoặc ma trận đề.' }, { status: 400 });
  }

  const { data: worksheet, error: wsError } = await supabaseAdmin.from('worksheets').insert({
    teacher_id: user.id,
    subject,
    title,
    kind: 'dethi',
    status: 'draft',
  }).select('*').single();
  if (wsError) return NextResponse.json({ error: wsError.message }, { status: 500 });

  let orderIndex = 0;
  const shortages = [];

  for (const cell of matrix) {
    const wanted = Number(cell.count) || 0;
    if (wanted <= 0) continue;

    const { data: candidates, error: qError } = await supabaseAdmin
      .from('questions')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('knowledge_tag_id', cell.knowledge_tag_id)
      .eq('level', cell.level);
    if (qError) continue;

    const shuffled = (candidates || []).sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, wanted);
    if (picked.length < wanted) {
      shortages.push({ knowledge_tag_id: cell.knowledge_tag_id, level: cell.level, wanted, available: picked.length });
    }
    for (const q of picked) {
      await supabaseAdmin.from('worksheet_questions').insert({
        worksheet_id: worksheet.id,
        question_id: q.id,
        order_index: orderIndex++,
      });
    }
  }

  return NextResponse.json({ success: true, worksheetId: worksheet.id, totalQuestions: orderIndex, shortages });
}
