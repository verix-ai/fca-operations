import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Users, Loader2, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react'
import { Button, Input, Label, Textarea } from '@/components/ui/primitives'
import { Message } from '@/entities/Message.supabase'
import User from '@/entities/User.supabase'

export default function BlastEmailModal({ isOpen, onClose }) {
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [recipientType, setRecipientType] = useState('all') // 'all' or 'specific'
    const [selectedUsers, setSelectedUsers] = useState([])
    const [availableUsers, setAvailableUsers] = useState([])
    const [status, setStatus] = useState('idle') // idle, sending, success, error
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Load potential recipients when modal opens or type changes to specific
    useEffect(() => {
        if (isOpen && recipientType === 'specific' && availableUsers.length === 0) {
            loadUsers()
        }
    }, [isOpen, recipientType])

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setStatus('idle')
            setSubject('')
            setBody('')
            setErrorMsg('')
            setSuccessMsg('')
        }
    }, [isOpen])

    const loadUsers = async () => {
        try {
            const users = await User.getActive()
            setAvailableUsers(users)
        } catch (err) {
            console.error('Failed to load users', err)
        }
    }

    const handleSend = async () => {
        if (!subject.trim() || !body.trim()) {
            setErrorMsg('Subject and Message are required')
            return
        }

        if (recipientType === 'specific' && selectedUsers.length === 0) {
            setErrorMsg('Please select at least one recipient')
            return
        }

        try {
            setStatus('sending')
            setErrorMsg('')

            const payload = {
                subject,
                content: body,
                allUsers: recipientType === 'all',
                recipientIds: recipientType === 'specific' ? selectedUsers : []
            }

            // Use the Message entity broadcast method instead of Email service
            const result = await Message.broadcast(payload)

            setStatus('success')
            setSuccessMsg(`Successfully broadcasted to ${result.sentCount} recipients.`)

            setTimeout(() => {
                onClose()
            }, 2000)
        } catch (err) {
            console.error('Broadcast send error:', err)
            setStatus('error')
            setErrorMsg(err.message || 'Failed to send broadcast')
        }
    }

    const toggleUser = (userId) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId))
        } else {
            setSelectedUsers([...selectedUsers, userId])
        }
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-hero-card border border-[rgba(147,165,197,0.25)] rounded-2xl shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)] flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div>
                        <h2 className="text-xl font-semibold text-heading-primary flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-brand" />
                            Broadcast Message
                        </h2>
                        <p className="text-sm text-heading-subdued mt-1">Send a direct message to multiple users in your team.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full text-heading-subdued transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">

                    {/* Recipient Selection */}
                    <div className="space-y-3">
                        <Label className="text-base">Recipients</Label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="recipientType"
                                    checked={recipientType === 'all'}
                                    onChange={() => setRecipientType('all')}
                                    className="accent-brand w-4 h-4"
                                />
                                <span className="text-heading-primary">All Users</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="recipientType"
                                    checked={recipientType === 'specific'}
                                    onChange={() => setRecipientType('specific')}
                                    className="accent-brand w-4 h-4"
                                />
                                <span className="text-heading-primary">Specific Users</span>
                            </label>
                        </div>

                        {recipientType === 'specific' && (
                            <div className="mt-4 border border-[rgba(147,165,197,0.25)] rounded-xl p-3 max-h-48 overflow-y-auto bg-black/20">
                                {availableUsers.length === 0 ? (
                                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted" /></div>
                                ) : (
                                    <div className="space-y-2">
                                        {availableUsers.map(u => (
                                            <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.includes(u.id)}
                                                    onChange={() => toggleUser(u.id)}
                                                    className="rounded border-white/20 bg-black/40 w-4 h-4 accent-brand"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-heading-primary truncate">{u.name}</div>
                                                    <div className="text-xs text-heading-subdued truncate">{u.email}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Important Announcement"
                            className="bg-black/20"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Write your message here..."
                            className="min-h-[200px] bg-black/20"
                        />
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3 text-green-400 text-sm">
                            <CheckCircle className="w-5 h-5 shrink-0" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-black/20 rounded-b-2xl">
                    <Button variant="outline" onClick={onClose} disabled={status === 'sending'}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={status === 'sending' || status === 'success'}
                        className="min-w-[120px]"
                    >
                        {status === 'sending' ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Sent
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Send Broadcast
                            </>
                        )}
                    </Button>
                </div>

            </div>
        </div>,
        document.body
    )
}
