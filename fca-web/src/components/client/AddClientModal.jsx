import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2 } from 'lucide-react';
import { Client } from '@/entities/Client.supabase';
import Program from '@/entities/Program.supabase';
import SettingsStore from '@/entities/Settings.supabase';
import { formatPhone } from '@/utils';

export default function AddClientModal({ isOpen, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [counties, setCounties] = useState([]);
    const [form, setForm] = useState({
        client_name: '',
        client_phone: '',
        client_email: '',
        location: '',
        program: '',
        notes: '',
    });

    useEffect(() => {
        if (isOpen) {
            // Load available programs
            Program.list().then(list => {
                setPrograms(list.map(p => p.name));
            }).catch(console.error);

            // Load counties from settings
            SettingsStore.get().then(settings => {
                const regions = settings?.regions || {};
                const countyList = Object.entries(regions).flatMap(([state, stateCounties]) =>
                    (stateCounties || []).map(c => `${c}, ${state}`)
                );
                setCounties(countyList);
            }).catch(console.error);
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.client_name.trim()) {
            setError('Client name is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Parse name into first/last
            const nameParts = form.client_name.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const clientData = {
                client_name: form.client_name,
                first_name: firstName,
                last_name: lastName,
                client_phone: form.client_phone || null,
                email: form.client_email || null,
                location: form.location || null,
                county: form.location || null,
                program: form.program || null,
                notes: form.notes || null,
                intake_date: new Date().toISOString().split('T')[0],
                current_phase: 'onboarding',
                status: 'active',
            };

            const newClient = await Client.create(clientData);
            onSuccess?.(newClient);
            onClose();
            // Reset form
            setForm({ client_name: '', client_phone: '', client_email: '', location: '', program: '', notes: '' });
        } catch (err) {
            console.error('Error creating client:', err);
            setError(err.message || 'Failed to create client');
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
                        <h2 className="text-xl font-semibold text-heading-primary">Add Client</h2>
                        <p className="text-sm text-heading-subdued mt-1">Create a new client directly</p>
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
                        <Label htmlFor="client_name" className="text-heading-primary">Client Name *</Label>
                        <Input
                            id="client_name"
                            name="client_name"
                            value={form.client_name}
                            onChange={handleChange}
                            placeholder="Enter client's full name"
                            className="rounded-xl"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="client_phone" className="text-heading-primary">Phone</Label>
                            <Input
                                id="client_phone"
                                name="client_phone"
                                value={form.client_phone}
                                onChange={(e) => setForm(prev => ({ ...prev, client_phone: formatPhone(e.target.value) }))}
                                placeholder="(555) 123-4567"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client_email" className="text-heading-primary">Email</Label>
                            <Input
                                id="client_email"
                                name="client_email"
                                type="email"
                                value={form.client_email}
                                onChange={handleChange}
                                placeholder="email@example.com"
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="location" className="text-heading-primary">Location / County</Label>
                            <Select value={form.location} onValueChange={(val) => setForm(prev => ({ ...prev, location: val }))}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Select county" />
                                </SelectTrigger>
                                <SelectContent>
                                    {counties.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="program" className="text-heading-primary">Program</Label>
                            <Select value={form.program} onValueChange={(val) => setForm(prev => ({ ...prev, program: val }))}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Select program" />
                                </SelectTrigger>
                                <SelectContent>
                                    {programs.map(p => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Creating...
                                </>
                            ) : (
                                'Add Client'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
