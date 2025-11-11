# Messaging and Notifications System - Setup Guide

**Date:** November 7, 2025  
**Project:** FCA (Family Care Alliance)

---

## Overview

A comprehensive internal messaging and notification system has been implemented, including:

1. **Direct Messaging** - Real-time messaging between users
2. **Admin Notifications** - Automated alerts for admins when:
   - New referrals are submitted
   - Client phases are completed (Intake, Onboarding, Service Initiation)
3. **Notification Center** - Bell icon with unread count and dropdown
4. **Notifications Page** - Full page view of all notifications

---

## Features Implemented

### 1. Database Schema

**New Tables:**
- `messages` - Internal direct messages between users
- `notifications` - System notifications for users

**Key Features:**
- Row Level Security (RLS) policies for data isolation
- Automatic timestamp triggers
- Foreign key relationships to users and organizations
- Indexed fields for performance

**Notification Types:**
- `referral_created` - New referral submitted
- `phase_completed` - Client phase completed
- `message_received` - New direct message
- `client_updated` - Client information updated
- `general` - General notifications

### 2. Backend Entity Files

**`Message.supabase.js`** - Message operations:
- `list()` - Get inbox/sent messages
- `send()` - Send a message
- `getConversation()` - Get conversation with specific user
- `markAsRead()` - Mark message as read
- `getUnreadCount()` - Get unread message count
- `getConversationList()` - Get all conversations with metadata
- `search()` - Search messages

**`Notification.supabase.js`** - Notification operations:
- `list()` - Get notifications with filtering
- `create()` - Create notification (admin/system)
- `markAsRead()` - Mark notification as read
- `markAllAsRead()` - Mark all as read
- `getUnreadCount()` - Get unread count
- `getUnreadCountByType()` - Get counts by type
- `clearRead()` - Delete all read notifications
- `subscribe()` - Real-time subscription

### 3. Frontend Components

**Messages Page (`Messages.jsx`):**
- Real-time messaging interface
- Conversation list with unread counts
- Message threads with timestamps
- Automatic read receipts
- Search functionality

**Notification Bell (`NotificationBell.jsx`):**
- Bell icon in header/navbar
- Badge with unread count
- Dropdown with recent notifications
- Mark as read/delete actions
- Click to navigate to related entities
- Real-time updates

**Notifications Page (`Notifications.jsx`):**
- Full-page notification center
- Filter by read/unread status
- Filter by notification type
- Mark all as read
- Clear read notifications
- Navigate to related entities (clients, referrals, messages)

### 4. Automated Notification Triggers

**Database Triggers:**
- **`notify_admins_on_referral()`** - Creates notifications for all admins when a new referral is created
- **`notify_admins_on_phase_completion()`** - Creates notifications for all admins when a client phase is finalized
- **`notify_on_message_received()`** - Creates notification for recipient when a message is sent

---

## Installation Instructions

### Step 1: Apply Database Migration

Run the migration file to create the tables, triggers, and policies:

```bash
# Navigate to your project directory
cd /Users/jalexander/Documents/10. Python Projects/FCA

# Connect to Supabase and run the migration
# Option 1: Using Supabase CLI
supabase db push supabase/migrations/add_messages_and_notifications.sql

# Option 2: Using psql directly (replace with your connection details)
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/add_messages_and_notifications.sql

# Option 3: Copy and paste the SQL into Supabase SQL Editor
# Open Supabase Dashboard > SQL Editor > New Query
# Paste the contents of supabase/migrations/add_messages_and_notifications.sql
# Click "Run"
```

### Step 2: Verify Installation

After running the migration, verify the tables were created:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('messages', 'notifications')
ORDER BY table_name;

-- Check triggers exist
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%notify%'
ORDER BY trigger_name;

-- Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('messages', 'notifications')
ORDER BY tablename, policyname;
```

### Step 3: Test the System

**Test Messaging:**
1. Log in as User A
2. Navigate to Messages page
3. Select a user from the list
4. Send a message
5. Log in as User B and check for the message

**Test Notifications - New Referral:**
1. Log in as a marketer
2. Go to Referral Form (MarketerIntake)
3. Submit a new referral
4. Log in as an admin
5. Check the notification bell - you should see a "New Referral Submitted" notification

**Test Notifications - Phase Completion:**
1. Log in as an admin
2. Open a client in the Intake phase
3. Complete all checkboxes in the Intake phase
4. Click "Submit" to finalize the phase
5. All admins should receive a "Intake Phase Completed" notification

---

## How It Works

### Notification Flow for New Referrals

1. Marketer submits referral via `MarketerIntake.jsx`
2. `Referral.create()` inserts record into `referrals` table
3. Database trigger `notify_admins_on_referral_trigger` fires
4. Trigger function `notify_admins_on_referral()` executes:
   - Queries all admin users in the organization
   - Creates a notification record for each admin
5. Real-time subscription in `NotificationBell.jsx` receives the new notification
6. Bell badge updates with new unread count
7. Admin clicks bell to see notification
8. Admin clicks notification to navigate to Prospects page

### Notification Flow for Phase Completion

1. User completes all checkboxes in a phase (e.g., Intake)
2. User clicks "Submit" button in `ClientOverview.jsx` or `PhaseProgress.jsx`
3. `Client.update()` sets `intake_finalized = true`
4. Database trigger `notify_admins_on_phase_completion_trigger` fires
5. Trigger function `notify_admins_on_phase_completion()` executes:
   - Detects which phase was finalized by comparing OLD and NEW values
   - Queries all admin users in the organization
   - Creates notification for each admin with client details
6. Real-time subscription updates notification bell
7. Admin clicks notification to navigate to Client Detail page

### Message Flow

1. User A composes message in `Messages.jsx`
2. `Message.send()` inserts record into `messages` table
3. Database trigger `notify_on_message_received_trigger` fires
4. Trigger creates notification for User B
5. User B's notification bell updates
6. User B opens Messages page
7. Message automatically marked as read
8. Unread count updates

---

## API Reference

### Message Entity

```javascript
import { Message } from '@/entities/Message.supabase'

// Get all conversations
const conversations = await Message.getConversationList()

// Get messages with specific user
const messages = await Message.getConversation(userId)

// Send a message
await Message.send({
  recipient_id: 'user-uuid',
  subject: 'Subject',
  content: 'Message content'
})

// Mark as read
await Message.markAsRead(messageId)

// Get unread count
const count = await Message.getUnreadCount()
```

### Notification Entity

```javascript
import { Notification } from '@/entities/Notification.supabase'

// Get all notifications
const notifications = await Notification.list()

// Get only unread notifications
const unread = await Notification.list({ unreadOnly: true })

// Get notifications by type
const referrals = await Notification.list({ type: 'referral_created' })

// Mark as read
await Notification.markAsRead(notificationId)

// Mark all as read
await Notification.markAllAsRead()

// Get unread count
const count = await Notification.getUnreadCount()

// Subscribe to real-time notifications
const subscription = Notification.subscribe((newNotification) => {
  console.log('New notification:', newNotification)
})

// Unsubscribe
subscription.unsubscribe()
```

---

## UI Components

### NotificationBell

Located in sidebar and mobile header. Features:
- Bell icon with badge showing unread count
- Dropdown with last 20 notifications
- Click notification to navigate to related page
- Mark individual or all as read
- Delete notifications
- "View all" link to Notifications page

### Messages Page

Full messaging interface with:
- Left sidebar: Conversation list with search
- Right panel: Message thread
- Unread message counts
- Automatic read receipts
- Real-time updates

### Notifications Page

Comprehensive notification management:
- Filter by all/unread
- Filter by type (Referrals, Phases, Messages)
- Mark all as read
- Clear all read notifications
- Click to view related entity
- Time stamps and relative time display

---

## Customization

### Adding New Notification Types

1. Update the CHECK constraint in the `notifications` table:
```sql
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('referral_created', 'phase_completed', 'message_received', 'client_updated', 'general', 'your_new_type'));
```

2. Add icon and color to frontend components:
```javascript
// In NotificationBell.jsx and Notifications.jsx
const getNotificationIcon = (type) => {
  switch (type) {
    case 'your_new_type':
      return '🎉'
    // ...
  }
}

const getNotificationColor = (type) => {
  switch (type) {
    case 'your_new_type':
      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
    // ...
  }
}
```

3. Create trigger function for new notification type:
```sql
CREATE OR REPLACE FUNCTION notify_on_your_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Your notification logic
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
    target_user_id,
    'your_new_type',
    'Title',
    'Message',
    'entity_type',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER your_trigger_name
  AFTER INSERT ON your_table
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_your_event();
```

---

## Troubleshooting

### Notifications Not Appearing

1. **Check RLS Policies:**
```sql
-- Verify user can see their notifications
SELECT * FROM notifications WHERE user_id = '[your-user-id]';
```

2. **Check Triggers:**
```sql
-- Verify triggers exist
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%notify%';
```

3. **Check Real-time Subscription:**
- Open browser console
- Look for WebSocket connection to Supabase
- Check for any error messages

### Messages Not Sending

1. **Check User IDs:**
```sql
-- Verify recipient exists
SELECT * FROM users WHERE id = '[recipient-id]';
```

2. **Check RLS Policies:**
```sql
-- Test insert permission
INSERT INTO messages (organization_id, sender_id, recipient_id, subject, content)
VALUES ('[org-id]', '[sender-id]', '[recipient-id]', 'Test', 'Test message');
```

3. **Check Foreign Keys:**
```sql
-- Verify organization_id matches for sender and recipient
SELECT u1.id as sender_id, u1.organization_id as sender_org,
       u2.id as recipient_id, u2.organization_id as recipient_org
FROM users u1, users u2
WHERE u1.id = '[sender-id]' AND u2.id = '[recipient-id]';
```

---

## Performance Considerations

### Indexes

The migration includes indexes on frequently queried fields:
- `messages`: organization_id, sender_id, recipient_id, is_read, created_at
- `notifications`: organization_id, user_id, type, is_read, created_at

### Cleanup

To prevent database bloat, consider implementing:

1. **Automatic Cleanup of Old Read Notifications** (30 days):
```sql
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE is_read = true
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available)
SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 'SELECT cleanup_old_notifications()');
```

2. **Archive Old Messages** (90 days):
```sql
-- Create archive table
CREATE TABLE messages_archive (LIKE messages INCLUDING ALL);

-- Archive function
CREATE OR REPLACE FUNCTION archive_old_messages()
RETURNS void AS $$
BEGIN
  INSERT INTO messages_archive
  SELECT * FROM messages
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM messages
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

---

## Security Considerations

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

**Messages:**
- Users can only see messages they sent or received
- Users can only send messages as themselves
- Users can only update messages they received (mark as read)

**Notifications:**
- Users can only see their own notifications
- System can create notifications for any user
- Users can only update their own notifications

### Input Validation

Frontend validation ensures:
- Message content is not empty
- Recipient is selected
- Subject is provided

Backend validation via database constraints:
- Foreign key constraints ensure valid user IDs
- NOT NULL constraints on required fields
- CHECK constraints on enum fields

---

## Future Enhancements

Potential improvements:

1. **Rich Text Editing** - Add markdown or HTML support for messages
2. **File Attachments** - Allow attaching files to messages
3. **Message Threading** - Group related messages together
4. **Push Notifications** - Browser/mobile push notifications
5. **Email Notifications** - Send email for important notifications
6. **Read Receipts** - Show when messages are read
7. **Typing Indicators** - Show when someone is typing
8. **Message Search** - Full-text search across messages
9. **Notification Preferences** - Allow users to customize notification settings
10. **Notification Sounds** - Audio alerts for new notifications

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase logs in Dashboard > Logs
3. Check browser console for JavaScript errors
4. Verify database schema matches migration

---

**Implementation Complete** ✅  
All features have been implemented and are ready for testing.

