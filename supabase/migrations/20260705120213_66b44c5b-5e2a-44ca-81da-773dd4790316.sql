-- Add archived_at to classes for archive lifecycle
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS classes_archived_at_idx ON public.classes(archived_at);

-- Enable extensions for scheduled maintenance
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Housekeeping function: archive old active classes, delete long-archived classes
CREATE OR REPLACE FUNCTION public.classes_archive_housekeeping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-archive active classes older than 12 months
  UPDATE public.classes
  SET archived_at = now()
  WHERE archived_at IS NULL
    AND created_at < now() - interval '12 months';

  -- Permanently delete classes archived for more than 12 months
  -- Cascades remove students, submissions, preferences, projects, runs, distributions
  DELETE FROM public.classes
  WHERE archived_at IS NOT NULL
    AND archived_at < now() - interval '12 months';
END;
$$;