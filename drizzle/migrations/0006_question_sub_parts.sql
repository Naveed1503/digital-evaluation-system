ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS part text NOT NULL DEFAULT '';
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_exam_id_number_key;
ALTER TABLE public.questions ADD CONSTRAINT questions_exam_number_part_key UNIQUE (exam_id, number, part);
ALTER TABLE public.questions ADD CONSTRAINT questions_part_format CHECK (part ~ '^[a-z]?$');