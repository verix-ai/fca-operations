-- ===================================================================
-- Restore marketer access to org peers for Direct Messages
-- Marketers need read access to other users in their organization so
-- the web app can render DM conversations and recipients.
-- ===================================================================

BEGIN;

-- Ensure we don't create duplicates if this script runs twice
DROP POLICY IF EXISTS marketers_select_org ON public.users;

CREATE POLICY "marketers_select_org"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'marketer'
  AND organization_id = public.current_user_organization()
);

COMMIT;







