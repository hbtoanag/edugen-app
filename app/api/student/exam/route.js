import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCaller, gradeQuestion } from '../../../../lib/serverAuth';

// Lấy đề (ẩn đáp án) hoặc, nếu đã nộp, lấy bản xem lại có đáp án + lời giải.
export async function POST(req) {
  const caller = await getCaller(req);
  if (!caller || caller.profile.role !== 'student') return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
  const { assignmentId } = await req.json();

  const { data: a } = await supabaseAdmin.from('assignments').select('*, worksheets(id, title, subject)').eq('id', assignmentId).single();
  if (!a) return NextResponse.json({ error: 'Không tìm thấy bài.' }, { status: 404 });
  const { data: member } = await supabaseAdmin.from('class_students').select('class_id').eq('class_id', a.class_id).eq('student_id', caller.user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: 'Bài này không được giao cho bạn.' }, { status: 403 });

  const { data: wq } = await supabaseAdmin.from('worksheet_questions').select('order_index, questions(*)').eq('worksheet_id', a.worksheets.id).order('order_index');
  const questions = (wq || []).map(r => r.questions).filter(Boolean);

  const { data: sub } = await supabaseAdmin.from('submissions').select('*').eq('assignment_id', assignmentId).eq('student_id', caller.user.id).maybeSingle();
  const base = { title: a.worksheets.title, subject: a.worksheets.subject, duration: a.duration_minutes, due_at: a.due_at };

  if (sub?.submitted_at) {
    const { data: answers } = await supabaseAdmin.from('submission_answers').select('*').eq('submission_id', sub.id);
    const ansMap = Object.fromEntries((answers || []).map(x => [x.question_id, x]));
    return NextResponse.json({ ...base, submitted: true, score: sub.score, questions: questions.map(q => ({ ...q, my_answer: ansMap[q.id]?.student_answer ?? null, is_correct: ansMap[q.id]?.is_correct ?? false })) });
  }

  // Ẩn toàn bộ đáp án khi đang làm bài
  const safe = questions.map(q => ({
    id: q.id, type: q.type, content_tex: q.content_tex, options: q.options,
    sub_statements: (q.sub_statements || []).map(s => ({ label: s.label, text: s.text })),
  }));
  return NextResponse.json({ ...base, submitted: false, questions: safe });
}
