/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Vercel chặn không cho đặt biến bắt đầu bằng NEXT_PUBLIC_ ở chế độ "Sensitive".
  // Để né lỗi đó, ta lưu 2 giá trị này trên Vercel với TÊN THƯỜNG (SUPABASE_URL, SUPABASE_ANON_KEY),
  // rồi map lại đúng tên NEXT_PUBLIC_ ở đây khi build — code trong app/ không cần đổi gì cả.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
};
