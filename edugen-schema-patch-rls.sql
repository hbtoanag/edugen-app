-- CHỈ chạy file này nếu bạn ĐÃ chạy schema.sql trước đó rồi (bổ sung RLS còn thiếu).
-- Nếu chưa chạy schema.sql lần nào thì bỏ qua file này, chỉ cần chạy schema.sql (bản mới đã có sẵn đầy đủ).

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
