ALTER TABLE public.runs
  DROP CONSTRAINT IF EXISTS runs_status_check;

ALTER TABLE public.runs
  ADD CONSTRAINT runs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'error'));

UPDATE public.runs
SET status = 'error'
WHERE status = 'failed';