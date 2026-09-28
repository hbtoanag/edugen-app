// Gọi Gemini (văn bản). Tên model có thể đổi theo thời gian — xem aistudio.google.com nếu báo "model not found".
export const GEMINI_MODEL = 'gemini-2.5-flash';

export async function geminiText(prompt, { json = false, pdfBase64 = null } = {}) {
  const parts = [];
  if (pdfBase64) parts.push({ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } });
  parts.push({ text: prompt });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: json ? { response_mime_type: 'application/json' } : {} }),
    }
  );
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || 'Lỗi gọi Gemini');
  return j.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
