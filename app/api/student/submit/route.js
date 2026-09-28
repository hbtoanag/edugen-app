import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCaller, gradeQuestion } from '../../../../lib/serverAuth';

export async function POST(req) {
  const caller = await getCaller(req);
  if (!caller || caller.profile.role !== 'student') return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
  const { assignmentId, answers } = await req.json();

  const { data: a } = await supabaseAdmin.from('assignments').select('*, worksheets(id)').eq('id', assignmentId).single();
  if (!a) return NextResponse.json({ error: 'Không tìm thấy bài.' }, { status: 404 });
  const { data: member } = await supabaseAdmin.from('class_students').select('class_id').eq('class_id', a.class_id).eq('student_id', caller.user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: 'Bài này không được giao cho bạn.' }, { status: 403 });

  const { data: existing } = await supabaseAdmin.from('submissions').select('id, submitted_at').eq('assignment_id', assignmentId).eq('student_id', caller.user.id).maybeSingle();
  if (existing?.submitted_at) return NextResponse.json({ error: 'Bạn đã nộp bài này rồi.' }, { status: 400 });

  const { data: wq } = await supabaseAdmin.from('worksheet_questions').select('questions(*)').eq('worksheet_id', a.worksheets.id);
  const questions = (wq || []).map(r => r.questions).filter(Boolean);

  let earned = 0, max = 0;
  const rows = [];
  const tagAgg = {}; // tag -> {sum, n}
  for (const q of questions) {
    const g = gradeQuestion(q, (answers || {})[q.id]);
    earned += g.earned; max += g.max;
    rows.push({ question_id: q.id, student_answer: (answers || {})[q.id] ?? null, is_correct: g.correct, score: g.earned });
    if (q.knowledge_tag_id) {
      tagAgg[q.knowledge_tag_id] = tagAgg[q.knowledge_tag_id] || { sum: 0, n: 0 };
      tagAgg[q.knowledge_tag_id].sum += g.fraction; tagAgg[q.knowledge_tag_id].n += 1;
    }
  }
  const score = max > 0 ? Math.round((earned / max) * 100) / 10 : 0; // thang 10

  let submissionId = existing?.id;
  if (submissionId) {
    await supabaseAdmin.from('submissions').update({ submitted_at: new Date().toISOString(), score }).eq('id', submissionId);
  } else {
    const { data: s } = await supabaseAdmin.from('submissions').insert({ assignment_id: assignmentId, student_id: caller.user.id, submitted_at: new Date().toISOString(), score }).select('id').single();
    submissionId = s.id;
  }
  await supabaseAdmin.from('submission_answers').insert(rows.map(r => ({ ...r, submission_id: submissionId })));

  // Cập nhật thống kê theo nhãn kiến thức (để vẽ sơ đồ nhiệt & xác định phần yếu)
  for (const [tagId, v] of Object.entries(tagAgg)) {
    const pct = Math.round((v.sum / v.n) * 100);
    const { data: cur } = await supabaseAdmin.from('student_knowledge_stats').select('*').eq('student_id', caller.user.id).eq('knowledge_tag_id', tagId).maybeSingle();
    const trend = [...(cur?.trend || []), pct].slice(-6);
    await supabaseAdmin.from('student_knowledge_stats').upsert({
      student_id: caller.user.id, knowledge_tag_id: tagId,
      correct_count: (cur?.correct_count || 0) + Math.round(v.sum), total_count: (cur?.total_count || 0) + v.n,
      trend, updated_at: new Date().toISOString(),
    });
  }
  return NextResponse.json({ success: true, score });
}
