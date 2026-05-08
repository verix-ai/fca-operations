-- Add nullable free-text title column to users (e.g., "Chief Marketing Officer").
-- Capped at 100 chars to keep table renders sane.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_title_length_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_title_length_check
  CHECK (title IS NULL OR char_length(title) <= 100);

COMMENT ON COLUMN public.users.title IS 'Free-text job title shown alongside the user''s name (e.g., "Chief Marketing Officer"). Max 100 chars.';
