-- Migration: Add messages and notifications tables (FIXED VERSION)
-- Date: 2025-11-07
-- Purpose: Support internal messaging and admin notifications

-- ============================================================
-- DROP EXISTING TABLES IF THEY EXIST (to start fresh)
-- ============================================================
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX idx_messages_organization ON messages(organization_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Add comments
COMMENT ON TABLE messages IS 'Internal messaging between users';
COMMENT ON COLUMN messages.sender_id IS 'User who sent the message';
COMMENT ON COLUMN messages.recipient_id IS 'User who receives the message';
COMMENT ON COLUMN messages.subject IS 'Message subject line';
COMMENT ON COLUMN messages.content IS 'Message content/body';
COMMENT ON COLUMN messages.is_read IS 'Whether the message has been read';
COMMENT ON COLUMN messages.read_at IS 'Timestamp when message was read';

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('referral_created', 'phase_completed', 'message_received', 'client_updated', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT CHECK (related_entity_type IN ('client', 'referral', 'message', 'user')),
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX idx_notifications_organization ON notifications(organization_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Add comments
COMMENT ON TABLE notifications IS 'System notifications for users';
COMMENT ON COLUMN notifications.type IS 'Type of notification (referral_created, phase_completed, message_received, client_updated, general)';
COMMENT ON COLUMN notifications.title IS 'Notification title/heading';
COMMENT ON COLUMN notifications.message IS 'Notification content';
COMMENT ON COLUMN notifications.related_entity_type IS 'Type of entity this notification relates to';
COMMENT ON COLUMN notifications.related_entity_id IS 'ID of the related entity';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp when notification was read';

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Messages: Users can only see messages they sent or received
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

-- Messages: Users can create messages
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );

-- Messages: Users can update messages they received (mark as read)
CREATE POLICY "Users can update messages they received" ON messages
  FOR UPDATE
  USING (recipient_id = auth.uid());

-- Notifications: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Notifications: System can create notifications for any user (handled by triggers/functions)
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Notifications: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- Notifications: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER messages_updated_at_trigger
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();

-- Function to automatically mark message as read when read_at is set
CREATE OR REPLACE FUNCTION auto_mark_message_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    NEW.is_read = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-marking messages as read
CREATE TRIGGER auto_mark_message_read_trigger
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_message_read();

-- Function to automatically mark notification as read when read_at is set
CREATE OR REPLACE FUNCTION auto_mark_notification_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    NEW.is_read = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-marking notifications as read
CREATE TRIGGER auto_mark_notification_read_trigger
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_notification_read();

-- ============================================================
-- NOTIFICATION TRIGGERS FOR REFERRALS AND PHASES
-- ============================================================

-- Function to notify admins when a new referral is created
CREATE OR REPLACE FUNCTION notify_admins_on_referral()
RETURNS TRIGGER AS $$
DECLARE
  admin_user RECORD;
  referral_name TEXT;
BEGIN
  -- Extract referral name from notes JSON or use referred_by
  referral_name := COALESCE(
    (NEW.notes::jsonb->>'referral_name'),
    NEW.referred_by,
    'Unknown'
  );

  -- Create notifications for all admin users in the organization
  FOR admin_user IN 
    SELECT id, name FROM users 
    WHERE organization_id = NEW.organization_id 
    AND role = 'admin' 
    AND is_active = true
  LOOP
    INSERT INTO notifications (
      organization_id,
      user_id,
      type,
      title,
      message,
      related_entity_type,
      related_entity_id
    ) VALUES (
      NEW.organization_id,
      admin_user.id,
      'referral_created',
      'New Referral Submitted',
      'New referral for ' || referral_name || ' has been submitted and is awaiting review.',
      'referral',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for referral creation notifications
CREATE TRIGGER notify_admins_on_referral_trigger
  AFTER INSERT ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_referral();

-- Function to notify admins when a phase is completed
CREATE OR REPLACE FUNCTION notify_admins_on_phase_completion()
RETURNS TRIGGER AS $$
DECLARE
  admin_user RECORD;
  client_name TEXT;
  phase_name TEXT;
  phase_completed BOOLEAN;
BEGIN
  -- Build client name
  client_name := COALESCE(
    NEW.first_name || ' ' || NEW.last_name,
    NEW.client_name,
    'Client #' || NEW.id
  );

  phase_completed := false;

  -- Check if intake phase was just finalized
  IF NEW.intake_finalized = true AND (OLD.intake_finalized IS NULL OR OLD.intake_finalized = false) THEN
    phase_name := 'Intake Phase';
    phase_completed := true;
  -- Check if onboarding phase was just finalized
  ELSIF NEW.onboarding_finalized = true AND (OLD.onboarding_finalized IS NULL OR OLD.onboarding_finalized = false) THEN
    phase_name := 'Onboarding Phase';
    phase_completed := true;
  -- Check if service initiation phase was just finalized
  ELSIF NEW.service_initiation_finalized = true AND (OLD.service_initiation_finalized IS NULL OR OLD.service_initiation_finalized = false) THEN
    phase_name := 'Service Initiation Phase';
    phase_completed := true;
  END IF;

  -- If a phase was completed, notify all admins
  IF phase_completed THEN
    FOR admin_user IN 
      SELECT id, name FROM users 
      WHERE organization_id = NEW.organization_id 
      AND role = 'admin' 
      AND is_active = true
    LOOP
      INSERT INTO notifications (
        organization_id,
        user_id,
        type,
        title,
        message,
        related_entity_type,
        related_entity_id
      ) VALUES (
        NEW.organization_id,
        admin_user.id,
        'phase_completed',
        phase_name || ' Completed',
        client_name || ' has completed the ' || phase_name || '.',
        'client',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for phase completion notifications
CREATE TRIGGER notify_admins_on_phase_completion_trigger
  AFTER UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_phase_completion();

-- Function to create notification when a message is sent
CREATE OR REPLACE FUNCTION notify_on_message_received()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender's name
  SELECT name INTO sender_name FROM users WHERE id = NEW.sender_id;

  -- Create notification for recipient
  INSERT INTO notifications (
    organization_id,
    user_id,
    type,
    title,
    message,
    related_entity_type,
    related_entity_id
  ) VALUES (
    NEW.organization_id,
    NEW.recipient_id,
    'message_received',
    'New Message from ' || COALESCE(sender_name, 'Unknown'),
    'Subject: ' || NEW.subject,
    'message',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for message notifications
CREATE TRIGGER notify_on_message_received_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_message_received();

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Verify tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('messages', 'notifications')
ORDER BY table_name;

