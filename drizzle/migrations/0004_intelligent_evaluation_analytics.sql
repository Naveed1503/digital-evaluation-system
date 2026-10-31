CREATE TABLE public.ml_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text NOT NULL CHECK (source IN ('upload','live')),
  file_name text,
  row_count integer NOT NULL DEFAULT 0,
  column_count integer NOT NULL DEFAULT 0,
  profile jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_datasets TO authenticated;
GRANT ALL ON public.ml_datasets TO service_role;
ALTER TABLE public.ml_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml datasets admin" ON public.ml_datasets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ml_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.ml_datasets(id) ON DELETE CASCADE,
  algorithm text NOT NULL DEFAULT 'IsolationForest',
  n_estimators integer NOT NULL,
  contamination numeric NOT NULL,
  features text[] NOT NULL,
  label_column text,
  record_count integer NOT NULL DEFAULT 0,
  anomaly_count integer NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_runs TO authenticated;
GRANT ALL ON public.ml_runs TO service_role;
ALTER TABLE public.ml_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml runs admin" ON public.ml_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ml runs moderator read" ON public.ml_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'moderator'));

CREATE TABLE public.ml_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ml_runs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  record jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric NOT NULL,
  is_anomaly boolean NOT NULL,
  script_id uuid,
  exam text,
  subject text,
  evaluator text,
  record_date date,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','reviewed','investigate')),
  review_comment text,
  reviewed_by uuid,
  reviewed_at timestamptz
);
CREATE INDEX ml_results_run_idx ON public.ml_results(run_id);
CREATE INDEX ml_results_anom_idx ON public.ml_results(is_anomaly, review_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_results TO authenticated;
GRANT ALL ON public.ml_results TO service_role;
ALTER TABLE public.ml_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml results admin" ON public.ml_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ml results moderator flagged read" ON public.ml_results FOR SELECT TO authenticated
  USING (is_anomaly AND public.has_role(auth.uid(),'moderator'));

-- Moderators/admins record a review decision. Never touches marks.
CREATE OR REPLACE FUNCTION public.review_ml_flag(_result_id uuid, _status text, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _status NOT IN ('pending','reviewed','investigate') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.ml_results SET review_status = _status, review_comment = NULLIF(trim(_comment),''),
    reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _result_id AND is_anomaly;
  IF NOT FOUND THEN RAISE EXCEPTION 'Flagged record not found'; END IF;
  INSERT INTO public.audit_log(actor_id, action, script_id, details)
  SELECT auth.uid(), 'ml_review', script_id, _status || COALESCE(': ' || _comment, '') FROM public.ml_results WHERE id = _result_id;
END $$;
REVOKE ALL ON FUNCTION public.review_ml_flag(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_ml_flag(uuid,text,text) TO authenticated;