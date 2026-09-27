// CHỈ dùng trong API route (server). KHÔNG BAO GIỜ import file này vào code chạy trên trình duyệt.
// service_role key có toàn quyền, bỏ qua RLS -> dùng để Admin tạo tài khoản GV/HS.
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
