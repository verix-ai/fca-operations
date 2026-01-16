import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { ClientCaregiver } from '@/entities/ClientCaregiver.supabase';
import { formatPhone } from '@/utils';

export default function AddCaregiverModal({ isOpen, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        email: '',
        notes: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.full_name.trim()) {
            setError('Full name is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const caregiver = await ClientCaregiver.createStandalone(form);
            onSuccess?.(caregiver);
            onClose();
            // Reset form
            setForm({ full_name: '', phone: '', email: '', notes: '' });
        } catch (err) {
            console.error('Error creating caregiver:', err);
            setError(err.message || 'Failed to create caregiver');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[rgb(var(--card))] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-lg mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-heading-primary">Add Caregiver</h2>
                        <p className="text-sm text-heading-subdued mt-1">Create a standalone caregiver for onboarding</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-heading-primary">Full Name *</Label>
                        <Input
                            id="full_name"
                            name="full_name"
                            value={form.full_name}
                            onChange={handleChange}
                            placeholder="Enter caregiver's full name"
                            className="rounded-xl"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-heading-primary">Phone</Label>
                            <Input
                                id="phone"
                                name="phone"
                                value={form.phone}
                                onChange={(e) => setForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                                placeholder="(555) 123-4567"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-heading-primary">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="email@example.com"
                                className="rounded-xl"
                            />
                        </div>
                    </div>



                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-heading-primary">Notes</Label>
                        <Input
                            id="notes"
                            name="notes"
                            value={form.notes}
                            onChange={handleChange}
                            placeholder="Any additional notes..."
                            className="rounded-xl"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            borderRadius="999px"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            borderRadius="999px"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Add Caregiver'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
