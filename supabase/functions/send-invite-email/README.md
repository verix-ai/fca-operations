# Send Invite Email Edge Function

This Supabase Edge Function sends invitation emails to new team members.

## Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to your project

```bash
supabase link --project-ref your-project-ref
```

### 4. Choose an Email Provider

#### Option A: Resend (Recommended - Easiest)

1. Sign up at https://resend.com
2. Get your API key from the dashboard
3. Set the secret:
   ```bash
   supabase secrets set RESEND_API_KEY=your_api_key_here
   supabase secrets set EMAIL_FROM=noreply@yourdomain.com
   ```
   > **Note**: You need to verify your domain in Resend before using a custom "from" address, or use their default domain like `onboarding@resend.dev`

#### Option B: SendGrid

1. Sign up at https://sendgrid.com
2. Create an API key
3. Set the secrets:
   ```bash
   supabase secrets set SENDGRID_API_KEY=your_api_key_here
   supabase secrets set EMAIL_FROM=noreply@yourdomain.com
   supabase secrets set EMAIL_PROVIDER=sendgrid
   ```

#### Option C: Mailgun

1. Sign up at https://mailgun.com
2. Get your API key and domain
3. Set the secrets:
   ```bash
   supabase secrets set MAILGUN_API_KEY=your_api_key_here
   supabase secrets set MAILGUN_DOMAIN=your-domain.com
   supabase secrets set EMAIL_FROM=noreply@yourdomain.com
   supabase secrets set EMAIL_PROVIDER=mailgun
   ```

### 5. Deploy the Function

```bash
supabase functions deploy send-invite-email
```

### 6. Test the Function

You can test it locally:
```bash
supabase functions serve send-invite-email
```

Then test with curl:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-invite-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "inviteUrl": "https://yourapp.com/signup?invite=test-token",
    "inviteRole": "marketer",
    "organizationName": "Test Org",
    "inviterName": "John Doe"
  }'
```

## Environment Variables

- `RESEND_API_KEY` (required for Resend)
- `SENDGRID_API_KEY` (required for SendGrid)
- `MAILGUN_API_KEY` (required for Mailgun)
- `MAILGUN_DOMAIN` (required for Mailgun)
- `EMAIL_FROM` (optional, defaults to `noreply@yourdomain.com`)
- `EMAIL_PROVIDER` (optional, defaults to `resend`)

## Customization

To customize the email template, edit the `generateEmailTemplate()` function in `index.ts`.

## Troubleshooting

1. **Function not found**: Make sure you've deployed the function:
   ```bash
   supabase functions deploy send-invite-email
   ```

2. **Email not sending**: Check the function logs:
   ```bash
   supabase functions logs send-invite-email
   ```

3. **API errors**: Verify your email service API key is correct and has the right permissions.

4. **CORS errors**: The function includes CORS headers, but make sure your Supabase project allows Edge Function invocations.

