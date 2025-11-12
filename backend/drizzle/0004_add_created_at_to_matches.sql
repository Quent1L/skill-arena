-- Add created_at column to matches
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- Backfill created_at for existing rows that are null
UPDATE public.matches SET created_at = now() WHERE created_at IS NULL;
