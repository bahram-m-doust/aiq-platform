-- Add approved_at timestamp to files table to track when a document was approved
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS approved_at timestamptz;
