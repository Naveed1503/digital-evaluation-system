
alter table public.marks add column if not exists evaluator_remark text;
alter table public.marks add column if not exists moderation_reason text;

create table public.mark_revisions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  old_marks numeric,
  new_marks numeric,
  reason text not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.mark_revisions to authenticated;
grant all on public.mark_revisions to service_role;
alter table public.mark_revisions enable row level security;
create policy "revisions read" on public.mark_revisions for select to authenticated
  using (public.has_role(auth.uid(),'admin') or changed_by = auth.uid());

-- Draft save: partial marks allowed, range validated, script stays 'assigned'
create or replace function public.save_evaluation_draft(_script_id uuid, _marks jsonb, _remarks jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare sc public.scripts; q record; v numeric;
begin
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null or sc.evaluator_id <> auth.uid() then raise exception 'Not assigned to you'; end if;
  if sc.status <> 'assigned' then raise exception 'Script already submitted'; end if;
  for q in select * from public.questions where exam_id = sc.exam_id loop
    v := nullif(_marks->>q.id::text,'')::numeric;
    if v is not null and (v < 0 or v > q.max_marks) then raise exception 'Q% marks must be between 0 and %', q.number, q.max_marks; end if;
    insert into public.marks(script_id, question_id, evaluator_marks, evaluator_remark)
      values (_script_id, q.id, v, nullif(_remarks->>q.id::text,''))
      on conflict (script_id, question_id) do update set evaluator_marks = excluded.evaluator_marks, evaluator_remark = excluded.evaluator_remark;
  end loop;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'draft_saved',_script_id, sc.exam_id, 'valuation draft saved');
end; $$;

drop function if exists public.submit_evaluation(uuid, jsonb);
create function public.submit_evaluation(_script_id uuid, _marks jsonb, _remarks jsonb default '{}'::jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare sc public.scripts; q record; v numeric; total numeric := 0;
begin
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null or sc.evaluator_id <> auth.uid() then raise exception 'Not assigned to you'; end if;
  if sc.status <> 'assigned' then raise exception 'Script already submitted'; end if;
  for q in select * from public.questions where exam_id = sc.exam_id loop
    if coalesce(_marks->>q.id::text,'') = '' then raise exception 'Marks missing for Q%', q.number; end if;
    v := (_marks->>q.id::text)::numeric;
    if v < 0 or v > q.max_marks then raise exception 'Q% marks must be between 0 and %', q.number, q.max_marks; end if;
    insert into public.marks(script_id, question_id, evaluator_marks, evaluator_remark) values (_script_id, q.id, v, nullif(_remarks->>q.id::text,''))
      on conflict (script_id, question_id) do update set evaluator_marks = excluded.evaluator_marks, evaluator_remark = excluded.evaluator_remark;
    total := total + v;
  end loop;
  update public.scripts set evaluator_total=total, status='evaluated', evaluated_at=now() where id=_script_id;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'evaluated',_script_id, sc.exam_id, 'total '||total);
  return total;
end; $$;

drop function if exists public.submit_moderation(uuid, jsonb, text);
create function public.submit_moderation(_script_id uuid, _marks jsonb, _remark text, _reasons jsonb default '{}'::jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare sc public.scripts; q record; v numeric; prev numeric; rsn text; total numeric := 0; changes int := 0;
begin
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null or sc.moderator_id <> auth.uid() then raise exception 'Not assigned to you'; end if;
  if sc.status not in ('evaluated','moderated') then raise exception 'Script not ready for moderation'; end if;
  if exists (select 1 from public.exams where id=sc.exam_id and status='published') then raise exception 'Results already published'; end if;
  for q in select * from public.questions where exam_id = sc.exam_id loop
    if coalesce(_marks->>q.id::text,'') = '' then raise exception 'Marks missing for Q%', q.number; end if;
    v := (_marks->>q.id::text)::numeric;
    if v < 0 or v > q.max_marks then raise exception 'Q% marks must be between 0 and %', q.number, q.max_marks; end if;
    select coalesce(moderated_marks, evaluator_marks) into prev from public.marks where script_id=_script_id and question_id=q.id;
    rsn := nullif(trim(coalesce(_reasons->>q.id::text,'')),'');
    if prev is distinct from v then
      if rsn is null then raise exception 'A reason is required for changing Q%', q.number; end if;
      insert into public.mark_revisions(script_id, question_id, old_marks, new_marks, reason, changed_by)
        values (_script_id, q.id, prev, v, rsn, auth.uid());
      changes := changes + 1;
    end if;
    update public.marks set moderated_marks = v, remark = _remark,
      moderation_reason = case when prev is distinct from v then rsn else moderation_reason end
      where script_id=_script_id and question_id=q.id;
    total := total + v;
  end loop;
  update public.scripts set final_total=total, status='moderated', moderated_at=now() where id=_script_id;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'moderated',_script_id, sc.exam_id, 'final '||total||' (evaluator '||sc.evaluator_total||', '||changes||' change(s))');
  return total;
end; $$;

create or replace function public.reassign_script(_script_id uuid, _evaluator uuid, _moderator uuid)
returns void language plpgsql security definer set search_path = public as $$
declare sc public.scripts;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null then raise exception 'Script not found'; end if;
  if exists (select 1 from public.exams where id=sc.exam_id and status='published') then raise exception 'Results already published'; end if;
  if _evaluator is not null and not public.has_role(_evaluator,'evaluator') then raise exception 'Selected person is not an evaluator'; end if;
  if _moderator is not null and not public.has_role(_moderator,'moderator') then raise exception 'Selected person is not a moderator'; end if;
  if _evaluator is distinct from sc.evaluator_id and sc.status not in ('unassigned','assigned') then
    raise exception 'Evaluator cannot change after valuation is submitted';
  end if;
  if _moderator is distinct from sc.moderator_id and sc.status = 'moderated' then
    raise exception 'Moderator cannot change after moderation';
  end if;
  update public.scripts set evaluator_id=_evaluator, moderator_id=_moderator,
    status = case when sc.status in ('unassigned','assigned') then (case when _evaluator is null then 'unassigned' else 'assigned' end)::script_status else sc.status end
    where id=_script_id;
  update public.exams set status='evaluating' where id=sc.exam_id and status='draft' and _evaluator is not null;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'reassigned',_script_id, sc.exam_id, 'evaluator/moderator updated');
end; $$;
