
DROP TABLE IF EXISTS public.generated_groups CASCADE;
DROP TABLE IF EXISTS public.group_config_absent CASCADE;

ALTER TABLE public.group_configs DROP CONSTRAINT IF EXISTS group_configs_size_policy_check;
ALTER TABLE public.group_configs ALTER COLUMN size_policy DROP DEFAULT;
UPDATE public.group_configs SET size_policy = 'plus' WHERE size_policy NOT IN ('plus','minus');
ALTER TABLE public.group_configs ALTER COLUMN size_policy SET DEFAULT 'plus';
ALTER TABLE public.group_configs ADD CONSTRAINT group_configs_size_policy_check
  CHECK (size_policy IN ('plus','minus'));
ALTER TABLE public.group_configs DROP COLUMN IF EXISTS generated_at;

CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.group_configs(id) ON DELETE CASCADE,
  time_limit_seconds integer NOT NULL CHECK (time_limit_seconds BETWEEN 10 AND 180),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX runs_config_id_idx ON public.runs(config_id);
CREATE UNIQUE INDEX runs_one_favorite_per_config ON public.runs(config_id) WHERE is_favorite;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs owner all" ON public.runs FOR ALL TO authenticated
  USING (public.owns_config(config_id)) WITH CHECK (public.owns_config(config_id));

CREATE TABLE public.run_absent (
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  PRIMARY KEY (run_id, student_id)
);
CREATE INDEX run_absent_run_idx ON public.run_absent(run_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_absent TO authenticated;
GRANT ALL ON public.run_absent TO service_role;
ALTER TABLE public.run_absent ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_run(_run_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.runs r WHERE r.id = _run_id AND public.owns_config(r.config_id));
$$;

CREATE POLICY "run_absent owner all" ON public.run_absent FOR ALL TO authenticated
  USING (public.owns_run(run_id)) WITH CHECK (public.owns_run(run_id));

CREATE TABLE public.run_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  score integer NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  UNIQUE (run_id, rank)
);
CREATE INDEX run_distributions_run_idx ON public.run_distributions(run_id);
CREATE UNIQUE INDEX run_distributions_one_favorite_per_run ON public.run_distributions(run_id) WHERE is_favorite;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_distributions TO authenticated;
GRANT ALL ON public.run_distributions TO service_role;
ALTER TABLE public.run_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "run_distributions owner all" ON public.run_distributions FOR ALL TO authenticated
  USING (public.owns_run(run_id)) WITH CHECK (public.owns_run(run_id));

CREATE TABLE public.run_distribution_groups (
  distribution_id uuid NOT NULL REFERENCES public.run_distributions(id) ON DELETE CASCADE,
  group_index integer NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  PRIMARY KEY (distribution_id, group_index, student_id)
);
CREATE INDEX run_distribution_groups_dist_idx ON public.run_distribution_groups(distribution_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_distribution_groups TO authenticated;
GRANT ALL ON public.run_distribution_groups TO service_role;
ALTER TABLE public.run_distribution_groups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_distribution(_dist_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.run_distributions d WHERE d.id = _dist_id AND public.owns_run(d.run_id));
$$;

CREATE POLICY "run_distribution_groups owner all" ON public.run_distribution_groups FOR ALL TO authenticated
  USING (public.owns_distribution(distribution_id)) WITH CHECK (public.owns_distribution(distribution_id));
