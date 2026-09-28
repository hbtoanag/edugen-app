import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCaller, isWeak } from '../../../../lib/serverAuth';
import { geminiText } from '../../../../lib/gemini';

// Nhận định của AI về 1 học sinh. HS xem của chính mình; GV xem HS thuộc lớp mình dạy.
export async function POST(req) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  const { studentId } = await req.json();
  const targetId = caller.profile.role === 'student' ? caller.user.id : studentId;

  if (caller.profile.role === 'teacher') {
    const { data: ct } = await supabaseAdmin.from('class_teachers').select('class_id').eq('teacher_id', caller.user.id);
    const { data: cs } = await supabaseAdmin.from('class_students').select('class_id').eq('student_id', targetId);
    const mine = new Set((ct || []).map(x => x.class_id));
    if (!(cs || []).some(x => mine.has(x.class_id))) return NextResponse.json({ error: 'Học sinh này không thuộc lớp bạn dạy.' }, { status: 403 });
  } else if (caller.profile.role !== 'student') {
    return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
  }

  const { data: stats } = await supabaseAdmin.from('student_knowledge_stats').select('*, knowledge_tags(chapter, topic)').eq('student_id', targetId);
  const { data: student } = await supabaseAdmin.from('profiles').select('full_name').eq('id', targetId).single();
  if (!stats || stats.length === 0) return NextResponse.json({ message: 'Chưa có đủ dữ liệu bài làm để nhận định. Hãy hoàn thành thêm vài bài nhé!', weak: [], strong: [] });

  const rows = stats.map(s => ({ topic: s.knowledge_tags?.topic, chapter: s.knowledge_tags?.chapter, latest: s.trend?.slice(-1)[0] ?? 0, trend: s.trend, weak: isWeak(s.trend), id: s.knowledge_tag_id }));
  const weak = rows.filter(r => r.weak), strong = rows.filter(r => r.latest >= 80);

  const isSelf = caller.profile.role === 'student';
  const prompt = `Bạn là trợ lý học tập của giáo viên THPT. Dựa vào dữ liệu % làm đúng theo từng chủ đề kiến thức (mảng "trend" là các bài gần nhất, mới nhất ở cuối):
${JSON.stringify(rows.map(({ topic, chapter, trend, weak }) => ({ topic, chapter, trend, weak })))}
Viết nhận định ngắn gọn (tối đa 5 câu, tiếng Việt) ${isSelf ? 'gửi trực tiếp cho học sinh (xưng "em", giọng khích lệ, không phán xét)' : `dành cho giáo viên về học sinh ${student?.full_name} (khách quan, có gợi ý sư phạm)`}: nêu điểm mạnh, các chủ đề đang yếu (chỉ những chủ đề có weak=true), và lời khuyên củng cố cụ thể. Không dùng markdown, không gạch đầu dòng.`;
  let message;
  try { message = (await geminiText(prompt)).trim(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  await supabaseAdmin.from('ai_recommendations').insert({ student_id: targetId, knowledge_tag_ids: weak.map(w => w.id), message });
  return NextResponse.json({ message, weak, strong });
}
