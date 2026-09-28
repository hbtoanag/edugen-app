import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCaller, isWeak } from '../../../../lib/serverAuth';

// GV bấm nút: tạo NHÁP phiếu ôn tập riêng cho 1 học sinh, dựa trên các chủ đề đang yếu. GV phải duyệt rồi mới giao.
export async function POST(req) {
  const caller = await getCaller(req);
  if (!caller || caller.profile.role !== 'teacher') return NextResponse.json({ error: 'Chỉ giáo viên được dùng chức năng này.' }, { status: 403 });
  const { studentId, count = 10 } = await req.json();

  const { data: student } = await supabaseAdmin.from('profiles').select('full_name').eq('id', studentId).single();
  const { data: stats } = await supabaseAdmin.from('student_knowledge_stats').select('knowledge_tag_id, trend').eq('student_id', studentId);
  const weakTagIds = (stats || []).filter(s => isWeak(s.trend)).map(s => s.knowledge_tag_id);
  if (weakTagIds.length === 0) return NextResponse.json({ error: 'Học sinh này hiện chưa có chủ đề nào bị đánh giá là yếu (cần sai liên tiếp ở ≥2 bài gần nhất).' }, { status: 400 });

  const { data: pool } = await supabaseAdmin.from('questions').select('id, knowledge_tag_id').eq('teacher_id', caller.user.id).in('knowledge_tag_id', weakTagIds);
  if (!pool || pool.length === 0) return NextResponse.json({ error: 'Ngân hàng câu hỏi của bạn chưa có câu nào thuộc các chủ đề học sinh đang yếu.' }, { status: 400 });

  const picked = pool.sort(() => Math.random() - 0.5).slice(0, count);
  const { data: ws, error } = await supabaseAdmin.from('worksheets').insert({
    teacher_id: caller.user.id, subject: caller.profile.subject,
    title: `Ôn tập riêng — ${student?.full_name}`, kind: 'phieu', status: 'pending_review', source_student_id: studentId,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from('worksheet_questions').insert(picked.map((q, i) => ({ worksheet_id: ws.id, question_id: q.id, order_index: i })));
  return NextResponse.json({ success: true, worksheetId: ws.id, total: picked.length });
}
