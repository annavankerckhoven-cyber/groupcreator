ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS name text;

UPDATE public.runs
SET name = 'Untitled run'
WHERE name IS NULL;

ALTER TABLE public.runs
  ALTER COLUMN name SET DEFAULT 'Untitled run',
  ALTER COLUMN name SET NOT NULL;
