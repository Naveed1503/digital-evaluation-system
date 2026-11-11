CREATE INDEX IF NOT EXISTS scripts_exam_status_id_idx ON public.scripts (exam_id, status, id);
CREATE INDEX IF NOT EXISTS scripts_evaluator_status_id_idx ON public.scripts (evaluator_id, status, id) WHERE evaluator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scripts_moderator_status_id_idx ON public.scripts (moderator_id, status, id) WHERE moderator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS script_owners_student_script_idx ON public.script_owners (student_id, script_id);
CREATE INDEX IF NOT EXISTS mark_revisions_script_question_idx ON public.mark_revisions (script_id, question_id);