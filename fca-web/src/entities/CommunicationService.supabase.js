import { supabase } from '@/lib/supabase'

/**
 * Get current user's organization ID
 */
async function getUserOrganization() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: userProfile, error } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    if (error) throw error
    if (!userProfile?.organization_id) {
        throw new Error('User not assigned to an organization')
    }

    return { userId: user.id, organizationId: userProfile.organization_id }
}

/**
 * Communication tier limits
 */
const TIER_LIMITS = {
    email: {
        starter: 5000,
        professional: 25000,
        business: 50000,
        enterprise: 100000
    },
    sms: {
        starter: 250,
        professional: 1000,
        business: 2500,
        enterprise: 5000
    }
}

export const CommunicationService = {
    /**
     * Get subscription status for email and SMS
     */
    async getSubscriptionStatus() {
        const { organizationId } = await getUserOrganization()

        const { data: org, error } = await supabase
            .from('organizations')
            .select('email_subscription, sms_subscription, stripe_customer_id')
            .eq('id', organizationId)
            .single()

        if (error) throw error

        return {
            email: org?.email_subscription || { tier: null, status: 'inactive' },
            sms: org?.sms_subscription || { tier: null, status: 'inactive' },
            hasStripeCustomer: !!org?.stripe_customer_id
        }
    },

    /**
     * Get current period usage
     */
    async getUsage() {
        const { organizationId } = await getUserOrganization()

        // Get current period start (first of the month)
        const now = new Date()
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('communication_usage')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('period_start', periodStart)
            .single()

        if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

        return data || {
            email_count: 0,
            email_limit: 0,
            sms_count: 0,
            sms_limit: 0
        }
    },

    /**
     * Get available tiers
     */
    async getTiers() {
        const { data, error } = await supabase
            .from('communication_tiers')
            .select('*')
            .order('monthly_limit', { ascending: true })

        if (error) throw error

        const email = data.filter(t => t.service === 'email')
        const sms = data.filter(t => t.service === 'sms')

        return { email, sms }
    },

    /**
     * Send email via Edge Function
     */
    async sendEmail({ to, subject, body, recipientType, recipientId, recipientName }) {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: { to, subject, body, recipientType, recipientId, recipientName }
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        return data
    },

    /**
     * Send blast email via Edge Function
     */
    async sendBlastEmail({ subject, body, allUsers, recipientIds }) {
        const { data, error } = await supabase.functions.invoke('send-blast-email', {
            body: { subject, body, allUsers, recipientIds }
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        return data
    },

    /**
     * Send SMS via Edge Function
     */
    async sendSMS({ to, body, recipientType, recipientId, recipientName }) {
        const { data, error } = await supabase.functions.invoke('send-sms', {
            body: { to, body, recipientType, recipientId, recipientName }
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        return data
    },

    /**
     * Get communication history
     */
    async getHistory({ channel, limit = 50, offset = 0 } = {}) {
        const { organizationId } = await getUserOrganization()

        let query = supabase
            .from('communication_log')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (channel) {
            query = query.eq('channel', channel)
        }

        const { data, error } = await query
        if (error) throw error

        return data || []
    },

    /**
     * Create Stripe checkout session for subscription
     */
    async createCheckout(service, tierId) {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
            body: { service, tierId }
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        return data // { checkoutUrl }
    },

    /**
     * Check if can send (has active subscription with remaining quota)
     */
    async canSend(channel) {
        const [status, usage] = await Promise.all([
            this.getSubscriptionStatus(),
            this.getUsage()
        ])

        const subscription = channel === 'email' ? status.email : status.sms
        if (subscription.status !== 'active') {
            return { canSend: false, reason: 'No active subscription' }
        }

        const count = channel === 'email' ? usage.email_count : usage.sms_count
        const limit = channel === 'email' ? usage.email_limit : usage.sms_limit

        if (count >= limit) {
            return { canSend: false, reason: 'Monthly limit reached' }
        }

        return { canSend: true, remaining: limit - count }
    }
}

export default CommunicationService
