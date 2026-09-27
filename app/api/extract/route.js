import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const EXTRACT_PROMPT = `
Bạn là chuyên gia ra đề THPT Việt Nam, đồng thời là biên tập viên tài liệu học thuật. Đọc kỹ toàn bộ tài liệu PDF đính kèm.

NHIỆM VỤ 1 — Trích câu hỏi: liệt kê TẤT CẢ câu hỏi có trong tài liệu, mỗi câu xác định:
- "type": "trac_nghiem" (4 đáp án A/B/C/D) | "dung_sai" (có các ý a,b,c,d mỗi ý đúng/sai riêng) | "tra_loi_ngan" (điền đáp số)
- "level": "nhan_biet" | "thong_hieu" | "van_dung" | "van_dung_cao"
- "chapter": tên chương (ví dụ "Ứng dụng đạo hàm")
- "topic": chủ đề con cụ thể (ví dụ "Tiệm cận", "Cực trị hàm hợp")
- "content_tex": đề bài, công thức viết trong dấu $...$ (LaTeX)
- "options": nếu trac_nghiem, object {"A":"...","B":"...","C":"...","D":"..."}
- "sub_statements": nếu dung_sai, mảng [{"label":"a","text":"...","answer":true|false}, ...]
- "short_answer": nếu tra_loi_ngan, đáp số đúng dạng chuỗi
- "correct_answer": nếu trac_nghiem, chữ cái đúng
- "solution_tex": lời giải ngắn gọn (tự giải nếu tài liệu không có)
- "ability_group": "A" (giỏi) | "B" (khá) | "C" (trung bình/yếu) theo độ khó

NHIỆM VỤ 2 — Bản đọc sạch (clean_reading_content): viết lại TOÀN BỘ nội dung chuyên môn của tài liệu (câu hỏi, lời giải, lý thuyết nếu có) dưới dạng text sạch, dùng $...$ cho công thức Toán. TUYỆT ĐỐI loại bỏ: header/footer lặp lại mỗi trang, dòng "Nguồn:", "Tham khảo:", tên trường/tác giả không liên quan nội dung, số trang, watermark, logo. Trình bày mạch lạc, đánh số câu rõ ràng, sẵn sàng để học sinh đọc ôn tập trực tiếp.

CHỈ trả về một object JSON hợp lệ, đúng cấu trúc:
{"questions": [ ... như trên ... ], "clean_reading_content": "..."}
Không thêm chữ giải thích, không thêm markdown code fence.
`;

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace('Bearer ', '');

  const supabaseAsCaller = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabaseAsCaller.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

  const { documentId } = await req.json();

  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('teacher_id', user.id)
    .single();
  if (docError || !doc) {
    return NextResponse.json({ error: 'Không tìm thấy tài liệu hoặc bạn không sở hữu tài liệu này.' }, { status: 404 });
  }

  try {
    const { data: fileBlob, error: downloadError } = await supabaseAdmin
      .storage.from('documents').download(doc.file_path);
    if (downloadError) throw downloadError;

    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64Pdf = Buffer.from(arrayBuffer).toString('base64');

    // Lưu ý: tên model Gemini có thể thay đổi theo thời gian — kiểm tra danh sách model
    // đang khả dụng tại https://aistudio.google.com nếu gặp lỗi "model not found".
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64Pdf } },
              { text: EXTRACT_PROMPT },
            ],
          }],
          generationConfig: { response_mime_type: 'application/json' },
        }),
      }
    );
    const geminiJson = await geminiRes.json();
    if (!geminiRes.ok) {
      throw new Error(geminiJson.error?.message || 'Lỗi gọi Gemini API');
    }
    const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const items = parsed.questions || [];
    const cleanReadingContent = parsed.clean_reading_content || null;

    let inserted = 0;
    for (const item of items) {
      // Tìm hoặc tạo nhãn kiến thức tương ứng
      let { data: tag } = await supabaseAdmin
        .from('knowledge_tags')
        .select('id')
        .eq('subject', doc.subject)
        .eq('chapter', item.chapter)
        .eq('topic', item.topic)
        .maybeSingle();

      if (!tag) {
        const { data: newTag, error: tagError } = await supabaseAdmin
          .from('knowledge_tags')
          .insert({ subject: doc.subject, chapter: item.chapter, topic: item.topic })
          .select('id')
          .single();
        if (tagError) continue;
        tag = newTag;
      }

      const { error: qError } = await supabaseAdmin.from('questions').insert({
        document_id: doc.id,
        teacher_id: user.id,
        subject: doc.subject,
        type: item.type,
        level: item.level,
        knowledge_tag_id: tag.id,
        content_tex: item.content_tex,
        options: item.options || null,
        sub_statements: item.sub_statements || null,
        short_answer: item.short_answer || null,
        correct_answer: item.correct_answer || null,
        solution_tex: item.solution_tex || null,
        ability_group: item.ability_group || null,
      });
      if (!qError) inserted++;
    }

    await supabaseAdmin.from('documents')
      .update({ status: 'done', clean_reading_content: cleanReadingContent })
      .eq('id', doc.id);
    return NextResponse.json({ success: true, inserted });
  } catch (err) {
    await supabaseAdmin.from('documents').update({ status: 'error' }).eq('id', doc.id);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
