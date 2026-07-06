-- Add activated_at and labels to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS activated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}';

-- Backfill activated_at from created_at for existing rows
UPDATE public.classes SET activated_at = created_at WHERE activated_at IS NULL OR activated_at = now();

CREATE INDEX IF NOT EXISTS classes_labels_gin_idx ON public.classes USING GIN (labels);

-- Update housekeeping: use activated_at for auto-archive
CREATE OR REPLACE FUNCTION public.classes_archive_housekeeping()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.classes
  SET archived_at = now()
  WHERE archived_at IS NULL
    AND activated_at < now() - interval '12 months';

  DELETE FROM public.classes
  WHERE archived_at IS NOT NULL
    AND archived_at < now() - interval '12 months';
END;
$function$;