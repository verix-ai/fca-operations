import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, MessageSquare, Zap, Check, ArrowRight, Loader2, X, Sparkles } from 'lucide-react'
import CommunicationService from '@/entities/CommunicationService.supabase'

// Simple Toggle component
function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-white/20'
                }`}
        >
            <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    )
}

const EMAIL_TIERS = [
    { id: 'starter', name: 'Starter', emails: '5,000', price: 9 },
    { id: 'professional', name: 'Professional', emails: '25,000', price: 30 },
    { id: 'business', name: 'Business', emails: '50,000', price: 40 },
    { id: 'enterprise', name: 'Enterprise', emails: '100,000', price: 180 },
]

const SMS_TIERS = [
    { id: 'starter', name: 'Starter', texts: '250', price: 6 },
    { id: 'professional', name: 'Professional', texts: '1,000', price: 22 },
    { id: 'business', name: 'Business', texts: '2,500', price: 56 },
    { id: 'enterprise', name: 'Enterprise', texts: '5,000', price: 110 },
]

function UsageBar({ used, limit, label }) {
    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
    const isNearLimit = percentage >= 80

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-heading-subdued">{label}</span>
                <span className={isNearLimit ? 'text-amber-400' : 'text-heading-primary'}>
                    {used.toLocaleString()} / {limit.toLocaleString()}
                </span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ${isNearLimit ? 'bg-amber-500' : 'bg-brand'}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    )
}

function TierCard({ tier, type, isActive, onSelect, isLoading }) {
    const isEmail = type === 'email'
    const Icon = isEmail ? Mail : MessageSquare
    const amount = isEmail ? tier.emails : tier.texts
    const label = isEmail ? 'emails/mo' : 'texts/mo'

    return (
        <div
            className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${isActive
                ? 'border-brand bg-brand/10'
                : 'border-white/10 hover:border-brand/50 bg-black/20'
                }`}
            onClick={() => !isActive && onSelect(tier.id)}
        >
            {isActive && (
                <Badge className="absolute -top-2 -right-2 bg-brand text-white text-xs">
                    Active
                </Badge>
            )}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand" />
                </div>
                <div>
                    <h4 className="text-heading-primary font-semibold">{tier.name}</h4>
                    <p className="text-heading-subdued text-xs">{amount} {label}</p>
                </div>
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <span className="text-2xl font-bold text-heading-primary">${tier.price}</span>
                    <span className="text-heading-subdued text-sm">/mo</span>
                </div>
                {!isActive && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={isLoading}
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelect(tier.id)
                        }}
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                )}
            </div>
        </div>
    )
}

function PaidFeatureModal({ isOpen, onClose, onContinue, serviceName }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[rgba(7,12,21,0.95)] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-md mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-brand/20 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-brand" />
                    </div>
                    <div className="mb-2 flex justify-center">
                        <Badge className="bg-brand/10 text-brand hover:bg-brand/20 border-brand/20">
                            FEATURE COMING SOON
                        </Badge>
                    </div>
                    <h2 className="text-xl font-semibold text-heading-primary mb-2">
                        This Is A Paid Feature
                    </h2>
                    <p className="text-heading-subdued text-sm mb-6">
                        {serviceName} communication requires an active subscription. View our plans to get started.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="px-6"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled
                            className="gap-2 px-6 opacity-50"
                        >
                            Continue to see plans
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PlansModal({ isOpen, onClose, service, tiers, currentTier, onSubscribe, checkoutLoading }) {
    if (!isOpen) return null

    const isEmail = service === 'email'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[rgba(7,12,21,0.95)] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-3xl mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)] max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {isEmail ? <Mail className="w-5 h-5 text-brand" /> : <MessageSquare className="w-5 h-5 text-brand" />}
                        <h2 className="text-lg font-semibold text-heading-primary">
                            Choose Your {isEmail ? 'Email' : 'SMS'} Plan
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-heading-subdued hover:text-heading-primary">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        {tiers.map((tier) => (
                            <TierCard
                                key={tier.id}
                                tier={tier}
                                type={service}
                                isActive={currentTier === tier.id}
                                onSelect={(tierId) => onSubscribe(service, tierId)}
                                isLoading={checkoutLoading === `${service}_${tier.id}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function CommunicationServicesSection() {
    const [status, setStatus] = useState(null)
    const [usage, setUsage] = useState(null)
    const [loading, setLoading] = useState(true)
    const [checkoutLoading, setCheckoutLoading] = useState(null)

    // Modal states
    const [paidFeatureModal, setPaidFeatureModal] = useState({ open: false, service: null })
    const [plansModal, setPlansModal] = useState({ open: false, service: null })

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [statusData, usageData] = await Promise.all([
                CommunicationService.getSubscriptionStatus(),
                CommunicationService.getUsage()
            ])
            setStatus(statusData)
            setUsage(usageData)
        } catch (error) {
            console.error('Error loading communication status:', error)
        }
        setLoading(false)
    }

    async function handleSubscribe(service, tierId) {
        setCheckoutLoading(`${service}_${tierId}`)
        try {
            const { checkoutUrl } = await CommunicationService.createCheckout(service, tierId)
            if (checkoutUrl) {
                window.location.href = checkoutUrl
            }
        } catch (error) {
            console.error('Error creating checkout:', error)
            alert('Failed to start checkout. Please try again.')
        }
        setCheckoutLoading(null)
    }

    function handleToggle(service, isCurrentlyActive) {
        if (isCurrentlyActive) {
            // Already active - could show manage subscription or do nothing
            return
        }
        // Not active - show paid feature modal
        setPaidFeatureModal({ open: true, service })
    }

    function handleContinueToPlans() {
        const service = paidFeatureModal.service
        setPaidFeatureModal({ open: false, service: null })
        setPlansModal({ open: true, service })
    }

    if (loading) {
        return (
            <Card className="border border-[rgba(96,255,168,0.18)]">
                <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-brand" />
                </CardContent>
            </Card>
        )
    }

    const emailActive = status?.email?.status === 'active'
    const smsActive = status?.sms?.status === 'active'

    return (
        <>
            <Card className="border border-[rgba(96,255,168,0.18)]">
                <CardHeader className="border-b border-white/5">
                    <CardTitle className="text-heading-primary text-xl flex items-center gap-3">
                        <Zap className="w-5 h-5 text-brand" />
                        Communication Services
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Email Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-black/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
                                <Mail className="w-6 h-6 text-brand" />
                            </div>
                            <div>
                                <h4 className="text-heading-primary font-semibold">Email Communication</h4>
                                <p className="text-heading-subdued text-sm">
                                    {emailActive
                                        ? `${status.email.tier?.charAt(0).toUpperCase() + status.email.tier?.slice(1)} Plan Active`
                                        : 'Send emails directly to clients and caregivers'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {emailActive && (
                                <Badge className="bg-brand/15 text-brand border-brand/40">
                                    <Check className="w-3 h-3 mr-1" /> Active
                                </Badge>
                            )}
                            <Toggle
                                checked={emailActive}
                                onChange={() => handleToggle('email', emailActive)}
                            />
                        </div>
                    </div>

                    {/* Email Usage (if active) */}
                    {emailActive && usage && (
                        <div className="pl-16">
                            <UsageBar
                                used={usage.email_count}
                                limit={usage.email_limit}
                                label="Emails used this month"
                            />
                        </div>
                    )}

                    {/* SMS Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-black/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
                                <MessageSquare className="w-6 h-6 text-brand" />
                            </div>
                            <div>
                                <h4 className="text-heading-primary font-semibold">SMS/Text Communication</h4>
                                <p className="text-heading-subdued text-sm">
                                    {smsActive
                                        ? `${status.sms.tier?.charAt(0).toUpperCase() + status.sms.tier?.slice(1)} Plan Active`
                                        : 'Send text messages directly to clients and caregivers'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {smsActive && (
                                <Badge className="bg-brand/15 text-brand border-brand/40">
                                    <Check className="w-3 h-3 mr-1" /> Active
                                </Badge>
                            )}
                            <Toggle
                                checked={smsActive}
                                onChange={() => handleToggle('sms', smsActive)}
                            />
                        </div>
                    </div>

                    {/* SMS Usage (if active) */}
                    {smsActive && usage && (
                        <div className="pl-16">
                            <UsageBar
                                used={usage.sms_count}
                                limit={usage.sms_limit}
                                label="Texts used this month"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Paid Feature Modal */}
            <PaidFeatureModal
                isOpen={paidFeatureModal.open}
                onClose={() => setPaidFeatureModal({ open: false, service: null })}
                onContinue={handleContinueToPlans}
                serviceName={paidFeatureModal.service === 'email' ? 'Email' : 'SMS'}
            />

            {/* Plans Modal */}
            <PlansModal
                isOpen={plansModal.open}
                onClose={() => setPlansModal({ open: false, service: null })}
                service={plansModal.service}
                tiers={plansModal.service === 'email' ? EMAIL_TIERS : SMS_TIERS}
                currentTier={plansModal.service === 'email' ? status?.email?.tier : status?.sms?.tier}
                onSubscribe={handleSubscribe}
                checkoutLoading={checkoutLoading}
            />
        </>
    )
}
