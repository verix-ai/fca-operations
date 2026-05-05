-- Fix notifications RLS to allow message triggers to create notifications
-- The previous "System can create notifications" policy was dropped, breaking the trigger

-- Drop existing policy if it exists, then recreate
DROP POLICY IF EXISTS "Users can create notifications for org members" ON public.notifications;

-- Create a policy that allows authenticated users to create notifications
-- for users in the same organization
CREATE POLICY "Users can create notifications for org members"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
    -- Allow creating notifications for users in the same organization
    EXISTS (
        SELECT 1 FROM public.users u1
        JOIN public.users u2 ON u1.organization_id = u2.organization_id
        WHERE u1.id = auth.uid()
        AND u2.id = user_id
    )
);

-- Alternative: If there's a trigger that needs to create notifications,
-- we can also create a function with SECURITY DEFINER
-- CREATE OR REPLACE FUNCTION create_message_notification()
-- RETURNS TRIGGER
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--     INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, organization_id)
--     VALUES (
--         NEW.recipient_id,
--         'message_received',
--         'New Message',
--         'You have received a new message',
--         'message',
--         NEW.id,
--         NEW.organization_id
--     );
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
