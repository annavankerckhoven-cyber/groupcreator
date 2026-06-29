
CREATE OR REPLACE FUNCTION public.owns_class(_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.owns_config(_config_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_configs gc
    JOIN public.classes c ON c.id = gc.class_id
    WHERE gc.id = _config_id AND c.owner_id = auth.uid()
  );
$$;
