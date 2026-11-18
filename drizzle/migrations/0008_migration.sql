alter table public.exams add column if not exists pattern text not null default 'internal';
alter table public.exams drop constraint if exists exams_pattern_check;
alter table public.exams add constraint exams_pattern_check check (pattern in ('internal','semester'));
alter table public.questions add column if not exists unit integer;

-- Total with semester "best of two per unit" rule. Questions without a unit add directly;
-- within a unit, each question number's parts are summed and the best number counts.
create or replace function public.script_total(_script_id uuid, _moderated boolean)
returns numeric language sql stable security definer set search_path = public as $$
  with per_q as (
    select q.unit, q.number,
           sum(coalesce(case when _moderated then coalesce(m.moderated_marks, m.evaluator_marks) else m.evaluator_marks end, 0)) as s
    from public.scripts sc
    join public.questions q on q.exam_id = sc.exam_id
    left join public.marks m on m.script_id = sc.id and m.question_id = q.id
    where sc.id = _script_id
    group by q.unit, q.number
  )
  select coalesce((select sum(s) from per_q where unit is null),0)
       + coalesce((select sum(mx) from (select max(s) mx from per_q where unit is not null group by unit) u),0)
$$;
revoke execute on function public.script_total(uuid, boolean) from public, anon;
grant execute on function public.script_total(uuid, boolean) to authenticated;

create or replace function public.submit_evaluation(_script_id uuid, _marks jsonb, _remarks jsonb default '{}'::jsonb)
returns numeric language plpgsql security definer set search_path to 'public' as $function$
declare sc public.scripts; q record; v numeric; total numeric; sem boolean;
begin
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null or sc.evaluator_id is distinct from auth.uid() then raise exception 'Not assigned to you'; end if;
  if sc.status <> 'assigned' then raise exception 'Script already submitted'; end if;
  select pattern = 'semester' into sem from public.exams where id = sc.exam_id;
  for q in select * from public.questions where exam_id = sc.exam_id loop
    v := nullif(_marks->>q.id::text,'')::numeric;
    if v is null and not (sem and q.unit is not null) then raise exception 'Marks missing for Q%', q.number||q.part; end if;
    if v is not null and (v < 0 or v > q.max_marks) then raise exception 'Q% marks must be between 0 and %', q.number||q.part, q.max_marks; end if;
    insert into public.marks(script_id, question_id, evaluator_marks, evaluator_remark) values (_script_id, q.id, v, nullif(_remarks->>q.id::text,''))
      on conflict (script_id, question_id) do update set evaluator_marks = excluded.evaluator_marks, evaluator_remark = excluded.evaluator_remark;
  end loop;
  total := public.script_total(_script_id, false);
  update public.scripts set evaluator_total=total, status='evaluated', evaluated_at=now() where id=_script_id;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'evaluated',_script_id, sc.exam_id, 'total '||total);
  return total;
end; $function$;

create or replace function public.submit_moderation(_script_id uuid, _marks jsonb, _remark text, _reasons jsonb default '{}'::jsonb)
returns numeric language plpgsql security definer set search_path to 'public' as $function$
declare sc public.scripts; q record; v numeric; prev numeric; rsn text; total numeric; changes int := 0; sem boolean;
begin
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null or sc.moderator_id is distinct from auth.uid() then raise exception 'Not assigned to you'; end if;
  if sc.status not in ('evaluated','moderated') then raise exception 'Script not ready for moderation'; end if;
  if exists (select 1 from public.exams where id=sc.exam_id and status='published') then raise exception 'Results already published'; end if;
  select pattern = 'semester' into sem from public.exams where id = sc.exam_id;
  for q in select * from public.questions where exam_id = sc.exam_id loop
    v := nullif(_marks->>q.id::text,'')::numeric;
    if v is null and not (sem and q.unit is not null) then raise exception 'Marks missing for Q%', q.number||q.part; end if;
    if v is not null and (v < 0 or v > q.max_marks) then raise exception 'Q% marks must be between 0 and %', q.number||q.part, q.max_marks; end if;
    select coalesce(moderated_marks, evaluator_marks) into prev from public.marks where script_id=_script_id and question_id=q.id;
    rsn := nullif(trim(coalesce(_reasons->>q.id::text,'')),'');
    if prev is distinct from v then
      if rsn is null then raise exception 'A reason is required for changing Q%', q.number||q.part; end if;
      insert into public.mark_revisions(script_id, question_id, old_marks, new_marks, reason, changed_by)
        values (_script_id, q.id, prev, v, rsn, auth.uid());
      changes := changes + 1;
    end if;
    insert into public.marks(script_id, question_id, moderated_marks, remark, moderation_reason)
      values (_script_id, q.id, v, _remark, case when prev is distinct from v then rsn end)
      on conflict (script_id, question_id) do update set moderated_marks = excluded.moderated_marks, remark = excluded.remark,
        moderation_reason = case when prev is distinct from v then rsn else public.marks.moderation_reason end;
  end loop;
  total := public.script_total(_script_id, true);
  update public.scripts set final_total=total, status='moderated', moderated_at=now() where id=_script_id;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'moderated',_script_id, sc.exam_id, 'final '||total||' (evaluator '||sc.evaluator_total||', '||changes||' change(s))');
  return total;
end; $function$;
revoke execute on function public.submit_evaluation(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.submit_moderation(uuid, jsonb, text, jsonb) from public, anon;
grant execute on function public.submit_evaluation(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.submit_moderation(uuid, jsonb, text, jsonb) to authenticated;