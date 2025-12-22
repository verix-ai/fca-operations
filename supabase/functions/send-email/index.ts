import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'noreply@verix.ai'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        // Get user from auth header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase client with user's auth
        const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            global: { headers: { Authorization: authHeader } }
        })

        // Service role client for database operations
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        // Get user and organization
        const { data: { user } } = await supabaseUser.auth.getUser()
        if (!user) {
            return new Response(
                JSON.stringify({ error: 'User not authenticated' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('organization_id')
            .eq('id', user.id)
            .single()

        if (!userProfile?.organization_id) {
            return new Response(
                JSON.stringify({ error: 'User not assigned to organization' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const organizationId = userProfile.organization_id

        // Get organization subscription
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('email_subscription')
            .eq('id', organizationId)
            .single()

        const subscription = org?.email_subscription
        if (!subscription || subscription.status !== 'active') {
            return new Response(
                JSON.stringify({ error: 'Email subscription not active', code: 'NO_SUBSCRIPTION' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get current period usage
        const now = new Date()
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

        let { data: usage } = await supabaseAdmin
            .from('communication_usage')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('period_start', periodStart)
            .single()

        // Create usage record if doesn't exist
        if (!usage) {
            const { data: tier } = await supabaseAdmin
                .from('communication_tiers')
                .select('monthly_limit')
                .eq('id', `email_${subscription.tier}`)
                .single()

            const { data: newUsage } = await supabaseAdmin
                .from('communication_usage')
                .insert({
                    organization_id: organizationId,
                    period_start: periodStart,
                    period_end: periodEnd,
                    email_count: 0,
                    email_limit: tier?.monthly_limit || 0,
                    sms_count: 0,
                    sms_limit: 0
                })
                .select()
                .single()

            usage = newUsage
        }

        // Check quota
        if (usage.email_count >= usage.email_limit) {
            return new Response(
                JSON.stringify({ error: 'Monthly email limit reached', code: 'LIMIT_REACHED' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const { to, subject, body, recipientType, recipientId, recipientName } = await req.json()

        if (!to || !subject || !body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Send via Resend
        if (!RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured')
        }

        const emailHtml = generateEmailHtml(body)

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: to,
                subject: subject,
                html: emailHtml,
            }),
        })

        if (!resendResponse.ok) {
            const errorText = await resendResponse.text()
            throw new Error(`Resend API error: ${errorText}`)
        }

        const resendData = await resendResponse.json()

        // Increment usage
        await supabaseAdmin
            .from('communication_usage')
            .update({ email_count: usage.email_count + 1 })
            .eq('id', usage.id)

        // Log communication
        await supabaseAdmin
            .from('communication_log')
            .insert({
                organization_id: organizationId,
                sent_by: user.id,
                channel: 'email',
                recipient_type: recipientType || 'client',
                recipient_id: recipientId || null,
                recipient_name: recipientName || null,
                recipient_address: to,
                subject: subject,
                content: body,
                status: 'sent',
                provider_message_id: resendData.id
            })

        return new Response(
            JSON.stringify({
                success: true,
                messageId: resendData.id,
                remaining: usage.email_limit - usage.email_count - 1
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error sending email:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

function generateEmailHtml(body: string) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px;">
    ${body.split('\n').map(p => `<p style="margin: 0 0 16px 0;">${p}</p>`).join('')}
  </div>
</body>
</html>
  `.trim()
}
