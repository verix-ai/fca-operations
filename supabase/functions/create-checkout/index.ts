import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno"

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://app.verix.ai'

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Price IDs (set these in Stripe Dashboard and update here)
const PRICE_IDS: Record<string, string> = {
    // Email tiers
    'email_starter': Deno.env.get('STRIPE_PRICE_EMAIL_STARTER') || '',
    'email_professional': Deno.env.get('STRIPE_PRICE_EMAIL_PROFESSIONAL') || '',
    'email_business': Deno.env.get('STRIPE_PRICE_EMAIL_BUSINESS') || '',
    'email_enterprise': Deno.env.get('STRIPE_PRICE_EMAIL_ENTERPRISE') || '',
    // SMS tiers
    'sms_starter': Deno.env.get('STRIPE_PRICE_SMS_STARTER') || '',
    'sms_professional': Deno.env.get('STRIPE_PRICE_SMS_PROFESSIONAL') || '',
    'sms_business': Deno.env.get('STRIPE_PRICE_SMS_BUSINESS') || '',
    'sms_enterprise': Deno.env.get('STRIPE_PRICE_SMS_ENTERPRISE') || '',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            global: { headers: { Authorization: authHeader } }
        })
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        // Get user
        const { data: { user } } = await supabaseUser.auth.getUser()
        if (!user) {
            return new Response(
                JSON.stringify({ error: 'Not authenticated' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get organization
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('organization_id, email, name')
            .eq('id', user.id)
            .single()

        if (!userProfile?.organization_id) {
            return new Response(
                JSON.stringify({ error: 'User not in organization' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id, name, stripe_customer_id')
            .eq('id', userProfile.organization_id)
            .single()

        const { service, tierId } = await req.json()

        if (!service || !tierId) {
            return new Response(
                JSON.stringify({ error: 'Missing service or tierId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const fullTierId = `${service}_${tierId}`
        const priceId = PRICE_IDS[fullTierId]

        if (!priceId) {
            return new Response(
                JSON.stringify({ error: `Price not configured for tier: ${fullTierId}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get or create Stripe customer
        let customerId = org?.stripe_customer_id

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: userProfile.email || user.email,
                name: org?.name || userProfile.name,
                metadata: {
                    organization_id: org?.id,
                    user_id: user.id
                }
            })
            customerId = customer.id

            // Save customer ID to organization
            await supabaseAdmin
                .from('organizations')
                .update({ stripe_customer_id: customerId })
                .eq('id', org?.id)
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${APP_URL}/settings?tab=communication&success=true`,
            cancel_url: `${APP_URL}/settings?tab=communication&canceled=true`,
            metadata: {
                organization_id: org?.id,
                service: service,
                tier: tierId
            }
        })

        return new Response(
            JSON.stringify({ checkoutUrl: session.url }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Checkout error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
