import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno"

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

// Tier limits lookup
const TIER_LIMITS: Record<string, number> = {
    'email_starter': 5000,
    'email_professional': 25000,
    'email_business': 50000,
    'email_enterprise': 100000,
    'sms_starter': 250,
    'sms_professional': 1000,
    'sms_business': 2500,
    'sms_enterprise': 5000,
}

serve(async (req) => {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
        return new Response('No signature', { status: 400 })
    }

    const body = await req.text()
    let event: Stripe.Event

    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)
    } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                const { organization_id, service, tier } = session.metadata || {}

                if (!organization_id || !service || !tier) {
                    console.error('Missing metadata in checkout session')
                    break
                }

                const fullTierId = `${service}_${tier}`
                const subscriptionId = session.subscription as string

                // Get subscription details
                const subscription = await stripe.subscriptions.retrieve(subscriptionId)

                const subscriptionData = {
                    tier: tier,
                    status: 'active',
                    stripe_subscription_id: subscriptionId,
                    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                    current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                }

                // Update organization subscription
                const updateField = service === 'email' ? 'email_subscription' : 'sms_subscription'
                await supabase
                    .from('organizations')
                    .update({ [updateField]: subscriptionData })
                    .eq('id', organization_id)

                // Create/update usage record for current period
                const now = new Date()
                const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
                const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

                const limitField = service === 'email' ? 'email_limit' : 'sms_limit'
                const limit = TIER_LIMITS[fullTierId] || 0

                await supabase
                    .from('communication_usage')
                    .upsert({
                        organization_id,
                        period_start: periodStart,
                        period_end: periodEnd,
                        [limitField]: limit
                    }, { onConflict: 'organization_id,period_start' })

                console.log(`Subscription activated: ${organization_id} - ${service} ${tier}`)
                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription
                const customerId = subscription.customer as string

                // Find organization by stripe customer id
                const { data: org } = await supabase
                    .from('organizations')
                    .select('id, email_subscription, sms_subscription')
                    .eq('stripe_customer_id', customerId)
                    .single()

                if (!org) {
                    console.error('Organization not found for customer:', customerId)
                    break
                }

                // Determine which subscription this is
                const subscriptionId = subscription.id
                let service: 'email' | 'sms' | null = null

                if (org.email_subscription?.stripe_subscription_id === subscriptionId) {
                    service = 'email'
                } else if (org.sms_subscription?.stripe_subscription_id === subscriptionId) {
                    service = 'sms'
                }

                if (!service) {
                    console.error('Subscription not matched to email or sms')
                    break
                }

                const status = subscription.status === 'active' ? 'active' : 'inactive'
                const updateField = service === 'email' ? 'email_subscription' : 'sms_subscription'
                const currentSub = org[updateField] || {}

                await supabase
                    .from('organizations')
                    .update({
                        [updateField]: {
                            ...currentSub,
                            status,
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                        }
                    })
                    .eq('id', org.id)

                console.log(`Subscription updated: ${org.id} - ${service} -> ${status}`)
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                const customerId = subscription.customer as string

                const { data: org } = await supabase
                    .from('organizations')
                    .select('id, email_subscription, sms_subscription')
                    .eq('stripe_customer_id', customerId)
                    .single()

                if (!org) break

                const subscriptionId = subscription.id

                if (org.email_subscription?.stripe_subscription_id === subscriptionId) {
                    await supabase
                        .from('organizations')
                        .update({
                            email_subscription: { tier: null, status: 'inactive', stripe_subscription_id: null }
                        })
                        .eq('id', org.id)
                    console.log(`Email subscription deleted: ${org.id}`)
                } else if (org.sms_subscription?.stripe_subscription_id === subscriptionId) {
                    await supabase
                        .from('organizations')
                        .update({
                            sms_subscription: { tier: null, status: 'inactive', stripe_subscription_id: null }
                        })
                        .eq('id', org.id)
                    console.log(`SMS subscription deleted: ${org.id}`)
                }
                break
            }
        }
    } catch (error) {
        console.error('Webhook processing error:', error)
        return new Response(`Error: ${error.message}`, { status: 500 })
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' }
    })
})
