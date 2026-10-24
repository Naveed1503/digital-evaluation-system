
create type public.app_role as enum ('admin', 'evaluator', 'moderator', 'student');
create type public.exam_status as enum ('draft', 'evaluating', 'published');
create type public.script_status as enum ('unassigned', 'assigned', 'evaluated', 'moderated');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  roll_number text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin add roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin remove roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), coalesce(new.email,''));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'student');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  course text not null default '',
  exam_date date,
  status exam_status not null default 'draft',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.exams to authenticated;
grant all on public.exams to service_role;
alter table public.exams enable row level security;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  number int not null,
  label text not null default '',
  max_marks numeric not null check (max_marks > 0),
  unique (exam_id, number)
);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  code text not null,
  file_path text,
  sample_answers jsonb,
  status script_status not null default 'unassigned',
  evaluator_id uuid,
  moderator_id uuid,
  evaluator_total numeric,
  final_total numeric,
  evaluated_at timestamptz,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (exam_id, code)
);
grant select, insert, update, delete on public.scripts to authenticated;
grant all on public.scripts to service_role;
alter table public.scripts enable row level security;

-- Identity mapping kept separate so evaluators never see who wrote a script
create table public.script_owners (
  script_id uuid primary key references public.scripts(id) on delete cascade,
  student_id uuid not null
);
grant select, insert, update, delete on public.script_owners to authenticated;
grant all on public.script_owners to service_role;
alter table public.script_owners enable row level security;

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  evaluator_marks numeric,
  moderated_marks numeric,
  remark text,
  unique (script_id, question_id)
);
grant select on public.marks to authenticated;
grant all on public.marks to service_role;
alter table public.marks enable row level security;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  script_id uuid,
  exam_id uuid,
  details text,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

create or replace function public.can_see_script(_script_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.scripts s
    left join public.exams e on e.id = s.exam_id
    left join public.script_owners o on o.script_id = s.id
    where s.id = _script_id and (
      public.has_role(auth.uid(),'admin')
      or s.evaluator_id = auth.uid()
      or s.moderator_id = auth.uid()
      or (o.student_id = auth.uid() and e.status = 'published')
    )
  )
$$;

create policy "exams read" on public.exams for select to authenticated using (true);
create policy "exams admin write" on public.exams for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "questions read" on public.questions for select to authenticated using (true);
create policy "questions admin write" on public.questions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "scripts read" on public.scripts for select to authenticated using (public.can_see_script(id));
create policy "scripts admin write" on public.scripts for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "owners read" on public.script_owners for select to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "owners admin write" on public.script_owners for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "marks read" on public.marks for select to authenticated using (public.can_see_script(script_id));
create policy "audit admin read" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Admin directory of staff for assignment
create or replace function public.list_users_with_roles()
returns table (id uuid, full_name text, email text, roll_number text, roles app_role[])
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.roll_number,
    coalesce(array_agg(r.role) filter (where r.role is not null), '{}')
  from public.profiles p left join public.user_roles r on r.user_id = p.id
  where public.has_role(auth.uid(),'admin')
  group by p.id order by p.created_at
$$;

-- Round-robin assignment of unassigned scripts
create or replace function public.auto_assign(_exam_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare evals uuid[]; mods uuid[]; s record; i int := 0;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  select array_agg(user_id order by user_id) into evals from public.user_roles where role='evaluator';
  select array_agg(user_id order by user_id) into mods from public.user_roles where role='moderator';
  if evals is null then raise exception 'No evaluators available'; end if;
  if mods is null then raise exception 'No moderators available'; end if;
  for s in select id from public.scripts where exam_id=_exam_id and status='unassigned' order by code loop
    update public.scripts set evaluator_id = evals[(i % array_length(evals,1))+1],
      moderator_id = mods[(i % array_length(mods,1))+1], status='assigned' where id = s.id;
    i := i + 1;
  end loop;
  update public.exams set status='evaluating' where id=_exam_id and status='draft';
  insert into public.audit_log(actor_id, action, exam_id, details) values (auth.uid(),'auto_assign',_exam_id, i||' scripts assigned');
  return i;
end; $$;

-- marks: jsonb object { question_id: number }
create or replace function public.submit_evaluation(_script_id uuid, _marks jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare sc public.scripts; q record; v numeric; total numeric := 0;
begin
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null or sc.evaluator_id <> auth.uid() then raise exception 'Not assigned to you'; end if;
  if sc.status not in ('assigned','evaluated') then raise exception 'Script is locked'; end if;
  for q in select * from public.questions where exam_id = sc.exam_id loop
    if not (_marks ? q.id::text) then raise exception 'Marks missing for Q%', q.number; end if;
    v := (_marks->>q.id::text)::numeric;
    if v < 0 or v > q.max_marks then raise exception 'Q% marks must be between 0 and %', q.number, q.max_marks; end if;
    insert into public.marks(script_id, question_id, evaluator_marks) values (_script_id, q.id, v)
      on conflict (script_id, question_id) do update set evaluator_marks = excluded.evaluator_marks;
    total := total + v;
  end loop;
  update public.scripts set evaluator_total=total, status='evaluated', evaluated_at=now() where id=_script_id;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'evaluated',_script_id, sc.exam_id, 'total '||total);
  return total;
end; $$;

create or replace function public.submit_moderation(_script_id uuid, _marks jsonb, _remark text)
returns numeric language plpgsql security definer set search_path = public as $$
declare sc public.scripts; q record; v numeric; total numeric := 0;
begin
  select * into sc from public.scripts where id=_script_id;
  if sc.id is null or sc.moderator_id <> auth.uid() then raise exception 'Not assigned to you'; end if;
  if sc.status not in ('evaluated','moderated') then raise exception 'Script not ready for moderation'; end if;
  if exists (select 1 from public.exams where id=sc.exam_id and status='published') then raise exception 'Results already published'; end if;
  for q in select * from public.questions where exam_id = sc.exam_id loop
    if not (_marks ? q.id::text) then raise exception 'Marks missing for Q%', q.number; end if;
    v := (_marks->>q.id::text)::numeric;
    if v < 0 or v > q.max_marks then raise exception 'Q% marks must be between 0 and %', q.number, q.max_marks; end if;
    update public.marks set moderated_marks = v, remark = _remark where script_id=_script_id and question_id=q.id;
    total := total + v;
  end loop;
  update public.scripts set final_total=total, status='moderated', moderated_at=now() where id=_script_id;
  insert into public.audit_log(actor_id, action, script_id, exam_id, details) values (auth.uid(),'moderated',_script_id, sc.exam_id, 'final '||total||' (was '||sc.evaluator_total||')');
  return total;
end; $$;

create or replace function public.publish_results(_exam_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if exists (select 1 from public.scripts where exam_id=_exam_id and status <> 'moderated') then
    raise exception 'All scripts must be moderated before publishing';
  end if;
  update public.exams set status='published' where id=_exam_id;
  insert into public.audit_log(actor_id, action, exam_id, details) values (auth.uid(),'published',_exam_id,'results published');
end; $$;

create policy "admin manage files" on storage.objects for all to authenticated
  using (bucket_id='answer-scripts' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id='answer-scripts' and public.has_role(auth.uid(),'admin'));
create policy "assigned staff read files" on storage.objects for select to authenticated
  using (bucket_id='answer-scripts' and exists (
    select 1 from public.scripts s where s.file_path = storage.objects.name
      and (s.evaluator_id = auth.uid() or s.moderator_id = auth.uid())));
