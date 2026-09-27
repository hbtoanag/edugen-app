'use client';
import katex from 'katex';

// Tách chuỗi theo dấu $...$ rồi render riêng phần công thức bằng KaTeX, giữ nguyên phần chữ thường.
export default function QuestionKatex({ text }) {
  if (!text) return null;
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          const tex = part.slice(1, -1);
          let html;
          try {
            html = katex.renderToString(tex, { throwOnError: false });
          } catch (e) {
            html = tex;
          }
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
