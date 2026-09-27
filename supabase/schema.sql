-- =========================================================
-- EDUGEN — SCHEMA SUPABASE
-- Dán toàn bộ file này vào Supabase Dashboard > SQL Editor > Run
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- VAI TRÒ NGƯỜI DÙNG ----------
create type user_role as enum ('admin','teacher','student');
create type question_level as enum ('nhan_biet','thong_hieu','van_dung','van_dung_cao');
create type question_type as enum ('trac_nghiem','dung_sai','tra_loi_ngan');

-- profiles: mở rộng thông tin cho auth.users (Supabase Auth quản lý email/mật khẩu)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null,
  subject text,               -- môn dạy, chỉ áp dụng cho giáo viên (Toán, Lý, Hóa, Văn...)
  created_at timestamptz default now()
);

-- ---------- LỚP HỌC (chỉ Admin toàn quyền) ----------
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,          -- "12A1"
  school_year text,
  created_at timestamptz default now()
);

create table class_teachers (          -- GV nào dạy lớp nào, môn gì
  class_id uuid references classes(id) on delete cascade,
  teacher_id uuid references profiles(id) on delete cascade,
  subject text not null,
  primary key (class_id, teacher_id, subject)
);

create table class_students (
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  primary key (class_id, student_id)
);

-- ---------- NHÃN KIẾN THỨC (dùng cho sơ đồ nhiệt & hồ sơ HS) ----------
create table knowledge_tags (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  chapter text not null,
  topic text not null           -- "Tiệm cận", "Cực trị hàm hợp"...
);

-- ---------- MÔN HỌC (Admin quản lý, ai đăng nhập cũng đọc được để chọn) ----------
create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);
insert into subjects (name) values
  ('Toán'),('Ngữ văn'),('Tiếng Anh'),('Vật lý'),('Hóa học'),('Sinh học'),
  ('Lịch sử'),('Địa lý'),('Giáo dục Kinh tế và Pháp luật'),('Tin học'),
  ('Công nghệ'),('Giáo dục thể chất'),('Giáo dục Quốc phòng và An ninh'),
  ('Hoạt động trải nghiệm, hướng nghiệp');

-- ---------- TÀI LIỆU (chỉ GV sở hữu, Admin không đụng) ----------
create table documents (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references profiles(id) on delete cascade,
  subject text not null,
  title text not null,
  doc_type text not null default 'khac', -- de_thi_tham_khao | de_kiem_tra | tai_lieu_tong_hop | chuyen_de | khac
  chapter text,                     -- chương/chủ đề chính của tài liệu (tự khai khi tải lên)
  file_path text not null,          -- đường dẫn trong Supabase Storage
  status text default 'processing', -- processing | done | error
  ai_summary jsonb,                 -- tóm tắt kiến thức AI sinh ra
  clean_reading_content text,       -- nội dung đã được AI làm sạch (bỏ header/nguồn) để hiển thị dạng đọc
  created_at timestamptz default now()
);

-- ---------- NGÂN HÀNG CÂU HỎI ----------
create table questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete set null,
  teacher_id uuid references profiles(id) on delete cascade,
  subject text not null,
  type question_type not null,
  level question_level not null,
  knowledge_tag_id uuid references knowledge_tags(id),
  content_tex text not null,        -- đề bài (có thể chứa $...$ LaTeX)
  options jsonb,                    -- trắc nghiệm: {"A":"...","B":"...","C":"...","D":"..."}
  sub_statements jsonb,             -- đúng/sai: [{"label":"a","text":"...","answer":true}, ...]
  short_answer text,                -- trả lời ngắn: đáp số đúng
  correct_answer text,              -- trắc nghiệm: "A"
  solution_tex text,
  ability_group text,               -- Nhóm A/B/C
  created_at timestamptz default now()
);

-- ---------- PHIẾU BÀI TẬP / ĐỀ THI ----------
create table worksheets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references profiles(id) on delete cascade,
  subject text not null,
  title text not null,
  kind text not null,               -- 'phieu' (GV chọn tay) | 'dethi' (AI sinh)
  status text default 'draft',      -- draft | pending_review | published
  source_student_id uuid references profiles(id), -- khác NULL nếu là phiếu ôn tập riêng AI đề xuất
  created_at timestamptz default now()
);

create table worksheet_questions (
  worksheet_id uuid references worksheets(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  order_index int,
  primary key (worksheet_id, question_id)
);

-- ---------- GIAO BÀI & CHẤM ----------
create table assignments (
  id uuid primary key default gen_random_uuid(),
  worksheet_id uuid references worksheets(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  due_at timestamptz,
  created_at timestamptz default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  submitted_at timestamptz,
  score numeric,
  unique(assignment_id, student_id)
);

create table submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  student_answer jsonb,
  is_correct boolean,
  score numeric
);

-- ---------- THỐNG KÊ & AI ĐỊNH HƯỚNG (giai đoạn 2) ----------
create table student_knowledge_stats (
  student_id uuid references profiles(id) on delete cascade,
  knowledge_tag_id uuid references knowledge_tags(id) on delete cascade,
  correct_count int default 0,
  total_count int default 0,
  trend jsonb,                      -- lịch sử % đúng theo từng bài, để xét "yếu liên tục 2-3 bài"
  updated_at timestamptz default now(),
  primary key (student_id, knowledge_tag_id)
);

create table ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  knowledge_tag_ids uuid[],
  message text,
  suggested_worksheet_id uuid references worksheets(id),
  created_at timestamptz default now()
);

-- =========================================================
-- ROW LEVEL SECURITY — đúng mô hình: Admin quản lý người & lớp,
-- không đụng tài liệu/câu hỏi của GV; GV chỉ thấy dữ liệu của mình.
-- =========================================================
create or replace function get_my_role() returns text as $$
  select role::text from profiles where id = auth.uid();
$$ language sql security definer stable;

alter table profiles enable row level security;
create policy "admin full access" on profiles for all using (get_my_role() = 'admin');
create policy "self read" on profiles for select using (id = auth.uid());

alter table classes enable row level security;
create policy "admin manage classes" on classes for all using (get_my_role() = 'admin');
create policy "teacher view own classes" on classes for select using (
  exists (select 1 from class_teachers ct where ct.class_id = classes.id and ct.teacher_id = auth.uid())
);
create policy "student view own class" on classes for select using (
  exists (select 1 from class_students cs where cs.class_id = classes.id and cs.student_id = auth.uid())
);

alter table class_teachers enable row level security;
create policy "admin manage class_teachers" on class_teachers for all using (get_my_role() = 'admin');
create policy "teacher read own assignment" on class_teachers for select using (teacher_id = auth.uid());

alter table class_students enable row level security;
create policy "admin manage class_students" on class_students for all using (get_my_role() = 'admin');
create policy "teacher read own class roster" on class_students for select using (
  exists (select 1 from class_teachers ct where ct.class_id = class_students.class_id and ct.teacher_id = auth.uid())
);
create policy "student read own row" on class_students for select using (student_id = auth.uid());

alter table subjects enable row level security;
create policy "everyone read subjects" on subjects for select using (auth.uid() is not null);
create policy "admin manage subjects" on subjects for all using (get_my_role() = 'admin');

alter table documents enable row level security;
create policy "teacher own documents" on documents for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

alter table questions enable row level security;
create policy "teacher own questions" on questions for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

alter table worksheets enable row level security;
create policy "teacher own worksheets" on worksheets for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

alter table worksheet_questions enable row level security;
create policy "teacher own worksheet_questions" on worksheet_questions for all using (
  exists (select 1 from worksheets w where w.id = worksheet_questions.worksheet_id and w.teacher_id = auth.uid())
);

alter table assignments enable row level security;
create policy "teacher manage own assignments" on assignments for all using (
  exists (select 1 from worksheets w where w.id = assignments.worksheet_id and w.teacher_id = auth.uid())
);
create policy "admin view assignments" on assignments for select using (get_my_role() = 'admin');
create policy "student view own class assignments" on assignments for select using (
  exists (select 1 from class_students cs where cs.class_id = assignments.class_id and cs.student_id = auth.uid())
);

alter table submissions enable row level security;
create policy "student own submissions" on submissions for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "admin view submissions" on submissions for select using (get_my_role() = 'admin');
create policy "teacher view class submissions" on submissions for select using (
  exists (
    select 1 from assignments a join worksheets w on w.id = a.worksheet_id
    where a.id = submissions.assignment_id and w.teacher_id = auth.uid()
  )
);

-- knowledge_tags: ai đọc/ghi chung, không nhạy cảm -> cho mọi người đăng nhập đọc
alter table knowledge_tags enable row level security;
create policy "everyone read tags" on knowledge_tags for select using (auth.uid() is not null);
create policy "admin manage tags" on knowledge_tags for all using (get_my_role() = 'admin');

alter table submission_answers enable row level security;
create policy "student own answers" on submission_answers for all using (
  exists (select 1 from submissions s where s.id = submission_answers.submission_id and s.student_id = auth.uid())
) with check (
  exists (select 1 from submissions s where s.id = submission_answers.submission_id and s.student_id = auth.uid())
);
create policy "teacher view class answers" on submission_answers for select using (
  exists (
    select 1 from submissions s
    join assignments a on a.id = s.assignment_id
    join worksheets w on w.id = a.worksheet_id
    where s.id = submission_answers.submission_id and w.teacher_id = auth.uid()
  )
);
create policy "admin view answers" on submission_answers for select using (get_my_role() = 'admin');

alter table student_knowledge_stats enable row level security;
create policy "student read own stats" on student_knowledge_stats for select using (student_id = auth.uid());
create policy "admin read stats" on student_knowledge_stats for select using (get_my_role() = 'admin');
create policy "teacher read stats of own students" on student_knowledge_stats for select using (
  exists (
    select 1 from class_students cs join class_teachers ct on ct.class_id = cs.class_id
    where cs.student_id = student_knowledge_stats.student_id and ct.teacher_id = auth.uid()
  )
);

alter table ai_recommendations enable row level security;
create policy "student read own recommendations" on ai_recommendations for select using (student_id = auth.uid());
create policy "admin read recommendations" on ai_recommendations for select using (get_my_role() = 'admin');
create policy "teacher read recommendations of own students" on ai_recommendations for select using (
  exists (
    select 1 from class_students cs join class_teachers ct on ct.class_id = cs.class_id
    where cs.student_id = ai_recommendations.student_id and ct.teacher_id = auth.uid()
  )
);
