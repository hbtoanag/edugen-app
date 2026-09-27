-- Chạy file này trong Supabase SQL Editor để CẬP NHẬT database đã có sẵn
-- (không xóa dữ liệu cũ, chỉ thêm bảng/cột mới)

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);
insert into subjects (name)
select v from (values
  ('Toán'),('Ngữ văn'),('Tiếng Anh'),('Vật lý'),('Hóa học'),('Sinh học'),
  ('Lịch sử'),('Địa lý'),('Giáo dục Kinh tế và Pháp luật'),('Tin học'),
  ('Công nghệ'),('Giáo dục thể chất'),('Giáo dục Quốc phòng và An ninh'),
  ('Hoạt động trải nghiệm, hướng nghiệp')
) as t(v)
where not exists (select 1 from subjects where name = t.v);

alter table documents add column if not exists doc_type text not null default 'khac';
alter table documents add column if not exists chapter text;
alter table documents add column if not exists clean_reading_content text;

alter table subjects enable row level security;
drop policy if exists "everyone read subjects" on subjects;
create policy "everyone read subjects" on subjects for select using (auth.uid() is not null);
drop policy if exists "admin manage subjects" on subjects;
create policy "admin manage subjects" on subjects for all using (get_my_role() = 'admin');
