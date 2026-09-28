import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCaller } from '../../../../lib/serverAuth';
import { geminiText } from '../../../../lib/gemini';

export async function POST(req) {
  const caller = await getCaller(req);
  if (!caller || caller.profile.role !== 'teacher') return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
  const { documentId } = await req.json();
  const { data: doc } = await supabaseAdmin.from('documents').select('*').eq('id', documentId).eq('teacher_id', caller.user.id).single();
  if (!doc) return NextResponse.json({ error: 'Không tìm thấy tài liệu.' }, { status: 404 });

  try {
    const { data: blob, error: dErr } = await supabaseAdmin.storage.from('documents').download(doc.file_path);
    if (dErr) throw dErr;
    const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
    const prompt = `Bạn là giáo viên giỏi. Đọc tài liệu và tóm tắt kiến thức bằng tiếng Việt. Công thức viết trong $...$ (LaTeX). Bỏ qua header/nguồn/số trang.
Chỉ trả về JSON: {"main_topics":["..."],"key_formulas":["..."],"must_remember":["..."],"differentiation":{"A":"gợi ý cho HS giỏi","B":"gợi ý cho HS khá","C":"gợi ý cho HS cần củng cố"}}`;
    const text = await geminiText(prompt, { json: true, pdfBase64: base64 });
    const summary = JSON.parse(text.replace(/```json|```/g, '').trim());
    await supabaseAdmin.from('documents').update({ ai_summary: summary }).eq('id', doc.id);
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
