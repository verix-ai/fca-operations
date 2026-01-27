-- ==============================================================================
-- Mitigation for Database Linter Errors and Warnings
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Fix Security Definer View
-- Error: security_definer_view
-- Remediation: Set security_invoker = true to enforce checking permissions of the invoker.
-- ------------------------------------------------------------------------------
ALTER VIEW public.super_admins SET (security_invoker = true);


-- ------------------------------------------------------------------------------
-- 2. Fix RLS Disabled in Public
-- Error: rls_disabled_in_public
-- Remediation: Enable RLS and add a policy.
-- ------------------------------------------------------------------------------
ALTER TABLE public.cm_company_contacts ENABLE ROW LEVEL SECURITY;

-- Creating a policy to allow authenticated users to access contacts.
-- Adjust this policy if access should be more restricted (e.g., by organization).
-- For now, mirroring the previous "public" access but restricted to auth users only.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cm_company_contacts' AND policyname = 'Allow access to authenticated users'
    ) THEN
        CREATE POLICY "Allow access to authenticated users"
        ON public.cm_company_contacts
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. Fix Mutable Search Paths
-- Warning: function_search_path_mutable
-- Remediation: Set search_path = public for all affected functions.
-- Using dynamic SQL to handle potential signature variations safely.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT oid::regprocedure::text as func_signature
        FROM pg_proc
        WHERE proname IN (
            'notify_on_client_intake_completed',
            'set_updated_at_client_caregivers',
            'handle_new_user',
            'notify_on_cm_company_assignment',
            'notify_on_phase_completion',
            'update_updated_at_column',
            'update_messages_updated_at',
            'auto_mark_message_read',
            'auto_mark_notification_read',
            'notify_admins_on_referral',
            'notify_on_message_received',
            'user_organization_id',
            'user_role',
            'revoke_super_admin',
            'is_master_admin_email',
            'promote_to_super_admin'
        )
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public', func_record.func_signature);
    END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 4. Fix Permissive RLS Policies
-- Warning: rls_policy_always_true
-- Remediation: Replace overly permissive policies with safer ones.
-- ------------------------------------------------------------------------------

-- Table: public.invites
-- Problem: Policy `invites_update_all` allowed unrestricted UPDATE.
DROP POLICY IF EXISTS "invites_update_all" ON public.invites;

-- New Policy: Users can only update invites belonging to their organization.
-- Assuming `organization_id` exists on both `invites` and `users`.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invites' AND policyname = 'invites_update_org'
    ) THEN
        CREATE POLICY "invites_update_org"
        ON public.invites
        FOR UPDATE
        TO authenticated
        USING (
            organization_id IN (
                SELECT organization_id FROM public.users WHERE id = auth.uid()
            )
        )
        WITH CHECK (
            organization_id IN (
                SELECT organization_id FROM public.users WHERE id = auth.uid()
            )
        );
    END IF;
END $$;


-- Table: public.notifications
-- Problem: Policy `System can create notifications` was always true.
-- Since this is for system/service_role usage, we can drop the policy if we rely on service_role bypass.
-- If this was intended for authenticated users to create notifications, it should be restricted.
-- Assuming "System" implies service role which bypasses RLS anyway.
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;


-- Table: public.users
-- Problem: Policy `anon_insert_own` allowed anonymous INSERTs.
-- This effectively bypassed RLS for anon.
-- Dropping this policy assumes user creation is handled via Auth Triggers (handle_new_user)
-- or via Admin functions, not direct client-side insert into public.users.
DROP POLICY IF EXISTS "anon_insert_own" ON public.users;


COMMIT;
