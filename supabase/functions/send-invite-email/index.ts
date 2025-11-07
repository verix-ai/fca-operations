import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Email service configuration - read from environment
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'noreply@yourdomain.com'

// You can switch to other email providers by changing this
const EMAIL_PROVIDER = Deno.env.get('EMAIL_PROVIDER') || 'resend' // 'resend', 'sendgrid', 'mailgun', 'supabase'

serve(async (req) => {
  // Log environment status for debugging
  console.log('Function invoked', {
    method: req.method,
    hasResendKey: !!RESEND_API_KEY,
    emailFrom: EMAIL_FROM,
    provider: EMAIL_PROVIDER
  })
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { email, inviteUrl, inviteRole, organizationName, inviterName, token } = await req.json()

    // Validate required fields
    if (!email || !inviteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and invite URL are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
      )
    }

    // Generate email HTML template
    const emailHtml = generateEmailTemplate({
      inviteUrl,
      inviteRole,
      organizationName: organizationName || 'Your Organization',
      inviterName: inviterName || 'A team member',
    })

    // Generate email subject
    const subject = `You've been invited to join ${organizationName || 'Your Organization'}`

    let result
    
    // Route to appropriate email provider
    switch (EMAIL_PROVIDER.toLowerCase()) {
      case 'resend':
        result = await sendViaResend(email, subject, emailHtml)
        break
      case 'sendgrid':
        result = await sendViaSendGrid(email, subject, emailHtml)
        break
      case 'mailgun':
        result = await sendViaMailgun(email, subject, emailHtml)
        break
      case 'supabase':
        result = await sendViaSupabase(email, subject, emailHtml)
        break
      default:
        throw new Error(`Unsupported email provider: ${EMAIL_PROVIDER}`)
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    )
  } catch (error) {
    console.error('Error sending invite email:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      RESEND_API_KEY: RESEND_API_KEY ? 'SET' : 'NOT SET',
      EMAIL_FROM: EMAIL_FROM,
      EMAIL_PROVIDER: EMAIL_PROVIDER
    })
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack,
        config: {
          hasApiKey: !!RESEND_API_KEY,
          emailFrom: EMAIL_FROM,
          provider: EMAIL_PROVIDER
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    )
  }
})

/**
 * Generate HTML email template
 */
function generateEmailTemplate({ inviteUrl, inviteRole, organizationName, inviterName }: {
  inviteUrl: string
  inviteRole: string
  organizationName: string
  inviterName: string
}) {
  const roleDisplay = inviteRole === 'admin' ? 'Administrator' : 'Marketer'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to Join ${organizationName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">You've Been Invited!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hello,
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${roleDisplay}</strong>.
    </p>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${inviteUrl}" 
         style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      Or copy and paste this link into your browser:<br>
      <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px;">
      This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>This email was sent by ${organizationName}</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Send email via Resend
 */
async function sendViaResend(email: string, subject: string, html: string) {
  console.log('Attempting to send via Resend:', { email, EMAIL_FROM, hasApiKey: !!RESEND_API_KEY })
  
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  const requestBody = {
    from: EMAIL_FROM,
    to: email,
    subject: subject,
    html: html,
  }

  console.log('Resend request body:', { ...requestBody, html: html.substring(0, 100) + '...' })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  })

  console.log('Resend response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { message: errorText }
    }
    console.error('Resend API error:', {
      status: response.status,
      statusText: response.statusText,
      fullError: errorData,
      errorText: errorText
    })
    const errorMessage = errorData.message || errorData.error?.message || errorText || response.statusText
    throw new Error(`Resend API error (${response.status}): ${errorMessage}`)
  }

  const data = await response.json()
  console.log('Resend success:', data)
  return { messageId: data.id, provider: 'resend' }
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(email: string, subject: string, html: string) {
  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
  if (!SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY environment variable is not set')
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: EMAIL_FROM },
      subject: subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SendGrid API error: ${error || response.statusText}`)
  }

  return { messageId: 'sent', provider: 'sendgrid' }
}

/**
 * Send email via Mailgun
 */
async function sendViaMailgun(email: string, subject: string, html: string) {
  const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')
  const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN')
  
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables are required')
  }

  const formData = new FormData()
  formData.append('from', EMAIL_FROM)
  formData.append('to', email)
  formData.append('subject', subject)
  formData.append('html', html)

  const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mailgun API error: ${error || response.statusText}`)
  }

  const data = await response.json()
  return { messageId: data.id, provider: 'mailgun' }
}

/**
 * Send email via Supabase (if configured)
 */
async function sendViaSupabase(email: string, subject: string, html: string) {
  // Note: Supabase doesn't have a built-in email API
  // This would require using Supabase's auth admin API or a custom solution
  throw new Error('Supabase email provider not implemented. Use Resend, SendGrid, or Mailgun instead.')
}

