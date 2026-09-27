# Hướng dẫn triển khai EduGen

## Nếu bạn ĐÃ deploy được ở bản trước (chỉ cập nhật code mới)
1. Vào Supabase → SQL Editor → dán nội dung file `supabase/patch-2-subjects-documents.sql` → Run (thêm bảng Môn học + trường quản lý tài liệu, không mất dữ liệu cũ).
2. Lên GitHub, upload đè các file/thư mục mới vào đúng vị trí cũ trong repo (kéo-thả như trước, chọn "Replace" nếu được hỏi).
3. Vercel sẽ tự động build lại — không cần đổi Environment Variables (tên biến vẫn giữ nguyên: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY).
4. Xong, vào lại web kiểm tra tính năng mới.

---

Làm đúng theo thứ tự dưới đây. Mỗi bước chỉ là bấm chuột, không cần gõ code.

## Bước 1 — Tạo dự án Supabase
1. Vào supabase.com → New project.
2. Đặt tên, chọn mật khẩu database (lưu lại), chọn khu vực gần Việt Nam (Singapore).
3. Vào **SQL Editor** → dán toàn bộ nội dung file `supabase/schema.sql` → bấm **Run**.
4. Vào **Storage** → **New bucket** → đặt tên chính xác là `documents` → để chế độ **Private** (không public).
5. Vào **Project Settings → API** → lưu lại 3 giá trị:
   - `Project URL`
   - `anon public key`
   - `service_role key` (giữ bí mật, không chia sẻ với ai)

## Bước 2 — Lấy API key Gemini
1. Vào aistudio.google.com → đăng nhập bằng Google.
2. Bấm **Get API key** → **Create API key** → copy lại.
3. (Lưu ý: đây KHÔNG phải gói Gemini Pro bạn trả phí hàng tháng — đây là key riêng, có gói miễn phí đủ dùng để thử nghiệm.)

## Bước 3 — Đưa code lên GitHub
1. Vào github.com → New repository → đặt tên `edugen-app` → Create.
2. Trong repo trống đó, bấm **uploading an existing file** → kéo thả toàn bộ các file/thư mục mình gửi vào → Commit.

## Bước 4 — Deploy lên Vercel
1. Vào vercel.com → đăng nhập bằng tài khoản GitHub.
2. **Add New → Project** → chọn repo `edugen-app` vừa tạo → Import.
3. Ở phần **Environment Variables**, thêm đúng 4 dòng:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL ở Bước 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key ở Bước 1
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key ở Bước 1
   - `GEMINI_API_KEY` = key ở Bước 2
4. Bấm **Deploy**, đợi khoảng 1-2 phút.

## Bước 5 — Tạo tài khoản Admin đầu tiên (chính bạn)
Vì đây là tài khoản đầu tiên, cần tạo tay 1 lần trong Supabase:
1. Supabase → **Authentication → Users → Add user** → nhập email + mật khẩu của bạn.
2. Copy `User UID` vừa tạo.
3. Vào **Table Editor → profiles → Insert row**: `id` = UID vừa copy, `full_name` = tên bạn, `role` = `admin`.
4. Vào link Vercel vừa deploy → đăng nhập bằng email/mật khẩu đó → bạn sẽ vào thẳng Bảng điều khiển Admin.

Từ đây, mọi tài khoản Giáo viên/Học sinh khác đều tạo được ngay trong giao diện Admin, không cần vào Supabase nữa.

## Test thử luồng chính
1. Từ Admin, tạo 1 tài khoản Giáo viên (nhớ mật khẩu tạm hệ thống trả về).
2. Đăng nhập bằng tài khoản Giáo viên đó → vào trang Tài liệu → tải 1 file PDF đề Toán lên.
3. Đợi khoảng 10-30 giây, AI sẽ tự trích câu hỏi và hiển thị công thức Toán đẹp bằng KaTeX.

Nếu lỗi ở bước AI trích xuất, thường do tên model Gemini đã đổi — báo lại lỗi cụ thể hiện ra để mình sửa.
