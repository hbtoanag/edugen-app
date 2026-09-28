import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCaller } from '../../../../lib/serverAuth';

export async function POST(req) {
  const caller = await getCaller(req);
  if (!caller || caller.profile.role !== 'student') return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });

  const { data: cls } = await supabaseAdmin.from('class_students').select('class_id, classes(name)').eq('student_id', caller.user.id);
  const classIds = (cls || []).map(c => c.class_id);
  const className = cls?.[0]?.classes?.name || null;
  if (classIds.length === 0) return NextResponse.json({ className, items: [] });

  const { data: asg } = await supabaseAdmin
    .from('assignments').select('id, due_at, duration_minutes, created_at, worksheets(title, subject, kind)')
    .in('class_id', classIds).order('created_at', { ascending: false });
  const { data: subs } = await supabaseAdmin.from('submissions').select('assignment_id, score, submitted_at').eq('student_id', caller.user.id);
  const subMap = Object.fromEntries((subs || []).map(s => [s.assignment_id, s]));

  const items = (asg || []).map(a => ({
    id: a.id, title: a.worksheets?.title, subject: a.worksheets?.subject, kind: a.worksheets?.kind,
    due_at: a.due_at, duration: a.duration_minutes,
    submitted: !!subMap[a.id]?.submitted_at, score: subMap[a.id]?.score ?? null,
  }));
  return NextResponse.json({ className, items });
}
