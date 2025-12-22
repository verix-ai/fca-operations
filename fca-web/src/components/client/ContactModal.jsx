import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Mail, MessageSquare, Send, Loader2, AlertCircle } from 'lucide-react'
import CommunicationService from '@/entities/CommunicationService.supabase'

const SMS_CHAR_LIMIT = 160

export default function ContactModal({
    isOpen,
    onClose,
    recipient,
    recipientType = 'client',
    recipientId,
    defaultChannel = 'email'
}) {
    const [channel, setChannel] = useState(defaultChannel)
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [sending, setSending] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const [canSend, setCanSend] = useState({ canSend: false, remaining: 0 })

    useEffect(() => {
        if (isOpen) {
            checkQuota()
            setSubject('')
            setBody('')
            setError(null)
            setSuccess(false)
        }
    }, [isOpen, channel])

    async function checkQuota() {
        try {
            const result = await CommunicationService.canSend(channel)
            setCanSend(result)
        } catch (err) {
            setCanSend({ canSend: false, reason: 'Unable to check quota' })
        }
    }

    async function handleSend() {
        if (!canSend.canSend) return

        setSending(true)
        setError(null)

        try {
            if (channel === 'email') {
                if (!recipient?.email) throw new Error('No email address available')
                await CommunicationService.sendEmail({
                    to: recipient.email,
                    subject,
                    body,
                    recipientType,
                    recipientId,
                    recipientName: recipient.name
                })
            } else {
                const phone = recipient?.phone || recipient?.phone_numbers?.[0]
                if (!phone) throw new Error('No phone number available')
                await CommunicationService.sendSMS({
                    to: phone,
                    body,
                    recipientType,
                    recipientId,
                    recipientName: recipient.name
                })
            }
            setSuccess(true)
            setTimeout(() => onClose(), 1500)
        } catch (err) {
            setError(err.message)
        }
        setSending(false)
    }

    if (!isOpen) return null

    const hasEmail = !!recipient?.email
    const hasPhone = !!(recipient?.phone || recipient?.phone_numbers?.[0])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[rgba(7,12,21,0.95)] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-lg mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {channel === 'email' ? (
                            <Mail className="w-5 h-5 text-brand" />
                        ) : (
                            <MessageSquare className="w-5 h-5 text-brand" />
                        )}
                        <h2 className="text-lg font-semibold text-heading-primary">
                            Contact {recipient?.name || 'Recipient'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-heading-subdued hover:text-heading-primary transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Channel Toggle */}
                <div className="p-4 border-b border-white/5">
                    <div className="inline-flex bg-black/30 rounded-2xl p-1">
                        <button
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${channel === 'email'
                                    ? 'bg-brand text-white'
                                    : 'text-heading-subdued hover:text-heading-primary'
                                } ${!hasEmail && 'opacity-50 cursor-not-allowed'}`}
                            onClick={() => hasEmail && setChannel('email')}
                            disabled={!hasEmail}
                        >
                            <Mail className="w-4 h-4 inline mr-2" />
                            Email
                        </button>
                        <button
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${channel === 'sms'
                                    ? 'bg-brand text-white'
                                    : 'text-heading-subdued hover:text-heading-primary'
                                } ${!hasPhone && 'opacity-50 cursor-not-allowed'}`}
                            onClick={() => hasPhone && setChannel('sms')}
                            disabled={!hasPhone}
                        >
                            <MessageSquare className="w-4 h-4 inline mr-2" />
                            SMS
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Quota Warning */}
                    {!canSend.canSend && (
                        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {canSend.reason || 'Unable to send messages'}
                        </div>
                    )}

                    {/* Recipient */}
                    <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-heading-subdued mb-2 block">
                            To
                        </label>
                        <div className="px-4 py-3 bg-black/20 border border-white/10 rounded-2xl text-heading-primary">
                            {channel === 'email'
                                ? recipient?.email || 'No email available'
                                : recipient?.phone || recipient?.phone_numbers?.[0] || 'No phone available'}
                        </div>
                    </div>

                    {/* Subject (email only) */}
                    {channel === 'email' && (
                        <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-heading-subdued mb-2 block">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Enter subject..."
                                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-2xl text-heading-primary placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand/60"
                            />
                        </div>
                    )}

                    {/* Message Body */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs uppercase tracking-[0.2em] text-heading-subdued">
                                Message
                            </label>
                            {channel === 'sms' && (
                                <span className={`text-xs ${body.length > SMS_CHAR_LIMIT ? 'text-amber-400' : 'text-heading-subdued'}`}>
                                    {body.length} / {SMS_CHAR_LIMIT}
                                </span>
                            )}
                        </div>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder={`Type your ${channel === 'email' ? 'email' : 'text'} message...`}
                            rows={channel === 'email' ? 6 : 3}
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-2xl text-heading-primary placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand/60 resize-none"
                        />
                    </div>

                    {/* Remaining quota */}
                    {canSend.canSend && canSend.remaining !== undefined && (
                        <p className="text-xs text-heading-subdued text-center">
                            {canSend.remaining.toLocaleString()} {channel === 'email' ? 'emails' : 'texts'} remaining this month
                        </p>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="text-red-400 text-sm text-center">{error}</div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="text-brand text-sm text-center">
                            ✓ Message sent successfully!
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={sending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={
                            !canSend.canSend ||
                            !body.trim() ||
                            (channel === 'email' && !subject.trim()) ||
                            sending ||
                            success
                        }
                        className="gap-2"
                    >
                        {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Send {channel === 'email' ? 'Email' : 'Text'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
