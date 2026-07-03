GRANT SELECT, INSERT, UPDATE, DELETE ON public.runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_absent TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_distributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_distribution_groups TO authenticated;

GRANT ALL ON public.runs TO service_role;
GRANT ALL ON public.run_absent TO service_role;
GRANT ALL ON public.run_distributions TO service_role;
GRANT ALL ON public.run_distribution_groups TO service_role;