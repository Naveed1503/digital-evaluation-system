-- Tighten exam and question-paper visibility: previously any signed-in user could read
-- every exam and every question paper (USING (true)). Access is now decided by one
-- SECURITY DEFINER predicate mirroring can_see_script().
CREATE OR REPLACE FUNCTION public.can_see_exam(_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.exams e
    where e.id = _exam_id
      and (
        public.has_role(auth.uid(), 'admin')
        -- staff: only exams where a script is allocated to them
        or exists (
          select 1 from public.scripts s
          where s.exam_id = e.id
            and (s.evaluator_id = auth.uid() or s.moderator_id = auth.uid())
        )
        -- students: only after results are declared, and only for their own script
        or (
          e.status = 'published'
          and exists (
            select 1
            from public.scripts s
            join public.script_owners o on o.script_id = s.id
            where s.exam_id = e.id
              and o.student_id = auth.uid()
          )
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_see_exam(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "exams read" ON public.exams;
CREATE POLICY "exams read" ON public.exams
  FOR SELECT TO authenticated
  USING (public.can_see_exam(id));

DROP POLICY IF EXISTS "questions read" ON public.questions;
CREATE POLICY "questions read" ON public.questions
  FOR SELECT TO authenticated
  USING (public.can_see_exam(exam_id));
