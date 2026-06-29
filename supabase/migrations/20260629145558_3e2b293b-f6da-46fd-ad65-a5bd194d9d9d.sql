
-- =========================
-- profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- classes
-- =========================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX classes_owner_idx ON public.classes(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes owner all" ON public.classes FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper: does the current user own this class?
CREATE OR REPLACE FUNCTION public.owns_class(_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = auth.uid());
$$;

-- =========================
-- students
-- =========================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX students_class_idx ON public.students(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students owner all" ON public.students FOR ALL TO authenticated
  USING (public.owns_class(class_id)) WITH CHECK (public.owns_class(class_id));

-- =========================
-- share_links
-- =========================
CREATE TABLE public.share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX share_links_class_idx ON public.share_links(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_links owner all" ON public.share_links FOR ALL TO authenticated
  USING (public.owns_class(class_id)) WITH CHECK (public.owns_class(class_id));

-- =========================
-- submissions
-- =========================
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
CREATE INDEX submissions_class_idx ON public.submissions(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions owner all" ON public.submissions FOR ALL TO authenticated
  USING (public.owns_class(class_id)) WITH CHECK (public.owns_class(class_id));

-- =========================
-- preferences
-- =========================
CREATE TABLE public.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  target_student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('with','avoid')),
  UNIQUE (submission_id, target_student_id)
);
CREATE INDEX preferences_submission_idx ON public.preferences(submission_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferences TO authenticated;
GRANT ALL ON public.preferences TO service_role;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preferences owner all" ON public.preferences FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_id AND public.owns_class(s.class_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_id AND public.owns_class(s.class_id)
  ));

-- =========================
-- group_configs
-- =========================
CREATE TABLE public.group_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_size INTEGER NOT NULL CHECK (group_size >= 2),
  size_policy TEXT NOT NULL DEFAULT 'flex' CHECK (size_policy IN ('flex','strict')),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX group_configs_class_idx ON public.group_configs(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_configs TO authenticated;
GRANT ALL ON public.group_configs TO service_role;
ALTER TABLE public.group_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_configs owner all" ON public.group_configs FOR ALL TO authenticated
  USING (public.owns_class(class_id)) WITH CHECK (public.owns_class(class_id));
CREATE TRIGGER group_configs_updated_at BEFORE UPDATE ON public.group_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.owns_config(_config_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_configs gc
    JOIN public.classes c ON c.id = gc.class_id
    WHERE gc.id = _config_id AND c.owner_id = auth.uid()
  );
$$;

-- =========================
-- group_config_absent
-- =========================
CREATE TABLE public.group_config_absent (
  config_id UUID NOT NULL REFERENCES public.group_configs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  PRIMARY KEY (config_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_config_absent TO authenticated;
GRANT ALL ON public.group_config_absent TO service_role;
ALTER TABLE public.group_config_absent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_config_absent owner all" ON public.group_config_absent FOR ALL TO authenticated
  USING (public.owns_config(config_id)) WITH CHECK (public.owns_config(config_id));

-- =========================
-- generated_groups
-- =========================
CREATE TABLE public.generated_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.group_configs(id) ON DELETE CASCADE,
  group_index INTEGER NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  UNIQUE (config_id, student_id)
);
CREATE INDEX generated_groups_config_idx ON public.generated_groups(config_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_groups TO authenticated;
GRANT ALL ON public.generated_groups TO service_role;
ALTER TABLE public.generated_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generated_groups owner all" ON public.generated_groups FOR ALL TO authenticated
  USING (public.owns_config(config_id)) WITH CHECK (public.owns_config(config_id));
