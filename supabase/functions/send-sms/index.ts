import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')
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

        // Create Supabase clients
        const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            global: { headers: { Authorization: authHeader } }
        })
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
            .select('sms_subscription')
            .eq('id', organizationId)
            .single()

        const subscription = org?.sms_subscription
        if (!subscription || subscription.status !== 'active') {
            return new Response(
                JSON.stringify({ error: 'SMS subscription not active', code: 'NO_SUBSCRIPTION' }),
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
                .eq('id', `sms_${subscription.tier}`)
                .single()

            const { data: newUsage } = await supabaseAdmin
                .from('communication_usage')
                .insert({
                    organization_id: organizationId,
                    period_start: periodStart,
                    period_end: periodEnd,
                    email_count: 0,
                    email_limit: 0,
                    sms_count: 0,
                    sms_limit: tier?.monthly_limit || 0
                })
                .select()
                .single()

            usage = newUsage
        }

        // Check quota
        if (usage.sms_count >= usage.sms_limit) {
            return new Response(
                JSON.stringify({ error: 'Monthly SMS limit reached', code: 'LIMIT_REACHED' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const { to, body, recipientType, recipientId, recipientName } = await req.json()

        if (!to || !body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: to, body' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate phone number format
        const phoneNumber = formatPhoneNumber(to)
        if (!phoneNumber) {
            return new Response(
                JSON.stringify({ error: 'Invalid phone number format' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Send via Twilio
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
            throw new Error('Twilio credentials not configured')
        }

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
        const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

        const formData = new URLSearchParams()
        formData.append('From', TWILIO_PHONE_NUMBER)
        formData.append('To', phoneNumber)
        formData.append('Body', body)

        const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${twilioAuth}`,
            },
            body: formData.toString(),
        })

        if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text()
            throw new Error(`Twilio API error: ${errorText}`)
        }

        const twilioData = await twilioResponse.json()

        // Increment usage
        await supabaseAdmin
            .from('communication_usage')
            .update({ sms_count: usage.sms_count + 1 })
            .eq('id', usage.id)

        // Log communication
        await supabaseAdmin
            .from('communication_log')
            .insert({
                organization_id: organizationId,
                sent_by: user.id,
                channel: 'sms',
                recipient_type: recipientType || 'client',
                recipient_id: recipientId || null,
                recipient_name: recipientName || null,
                recipient_address: phoneNumber,
                subject: null,
                content: body,
                status: 'sent',
                provider_message_id: twilioData.sid
            })

        return new Response(
            JSON.stringify({
                success: true,
                messageId: twilioData.sid,
                remaining: usage.sms_limit - usage.sms_count - 1
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error sending SMS:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX for US)
 */
function formatPhoneNumber(phone: string): string | null {
    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '')

    // Handle US numbers
    if (digits.length === 10) {
        return `+1${digits}`
    } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`
    } else if (digits.length > 10 && phone.startsWith('+')) {
        return `+${digits}`
    }

    return null
}
