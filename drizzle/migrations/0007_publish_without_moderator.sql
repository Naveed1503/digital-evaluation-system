create or replace function public.publish_results(_exam_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.scripts where exam_id=_exam_id) then
    raise exception 'No scripts to publish';
  end if;
  if exists (select 1 from public.scripts where exam_id=_exam_id
             and not (status='moderated' or (status='evaluated' and moderator_id is null))) then
    raise exception 'All scripts must be evaluated (and moderated where a moderator is assigned) before publishing';
  end if;
  update public.scripts set final_total = evaluator_total
   where exam_id=_exam_id and status='evaluated' and moderator_id is null;
  update public.exams set status='published' where id=_exam_id;
  insert into public.audit_log(actor_id, action, exam_id, details) values (auth.uid(),'published',_exam_id,'results published');
end; $$;