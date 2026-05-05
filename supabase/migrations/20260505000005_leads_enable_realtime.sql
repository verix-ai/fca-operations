-- Enable Supabase Realtime for the leads table so the app can receive
-- INSERT events the moment the website's edge function inserts a new lead.
-- RLS still applies, so subscribers only receive events for rows they can see.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'leads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.leads';
  END IF;
END $$;
