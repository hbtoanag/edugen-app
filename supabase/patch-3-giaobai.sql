-- PATCH 3: Giao bài, chấm điểm, thống kê. Chạy trong Supabase SQL Editor (không mất dữ liệu cũ).

alter table assignments add column if not exists duration_minutes int default 45;

-- Giáo viên đọc được hồ sơ (tên) học sinh thuộc lớp mình dạy
drop policy if exists "teacher read own students" on profiles;
create policy "teacher read own students" on profiles for select using (
  exists (
    select 1 from class_students cs join class_teachers ct on ct.class_id = cs.class_id
    where cs.student_id = profiles.id and ct.teacher_id = auth.uid()
  )
);

-- Admin xem được tiêu đề phiếu/đề để thống kê toàn trường (không đọc được câu hỏi)
drop policy if exists "admin view worksheets" on worksheets;
create policy "admin view worksheets" on worksheets for select using (get_my_role() = 'admin');

-- Học sinh tự đọc thống kê kiến thức của mình (đã có), giáo viên xem khi cần: đã có policy ở schema chính.
-- Giáo viên xem được các bản ghi khuyến nghị AI của học sinh mình dạy (đã có).
-- Cho phép GV tạo/sửa ai_recommendations qua API (service role) nên không cần policy ghi.
