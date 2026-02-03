import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2 } from 'lucide-react';
import { ClientConnect } from '@/entities/ClientConnect.supabase';
import Program from '@/entities/Program.supabase';
import { CAREGIVER_RELATIONSHIPS } from '../../constants/caregiver.js';
import { formatPhone } from '@/utils';
import countiesData from '@/data/counties.json';

export default function EditClientConnectModal({ isOpen, onClose, onSuccess, entry }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [form, setForm] = useState({
        client_name: '',
        email: '',
        phone: '',
        location: '',
        caregiver_name: '',
        caregiver_phone: '',
        caregiver_email: '',
        relationship: '',
        program: '',
        company: '',
        pay_rate: '',
    });

    useEffect(() => {
        if (isOpen && entry) {
            // Populate form with existing entry data
            setForm({
                client_name: entry.client_name || '',
                email: entry.email || '',
                phone: entry.phone || '',
                location: entry.location || '',
                caregiver_name: entry.caregiver_name || '',
                caregiver_phone: entry.caregiver_phone || '',
                caregiver_email: entry.caregiver_email || '',
                relationship: entry.relationship || '',
                program: entry.program || '',
                company: entry.company || '',
                pay_rate: entry.pay_rate || '',
            });
            // Load available programs
            Program.list().then(list => {
                setPrograms(list.map(p => p.name));
            }).catch(console.error);
        }
    }, [isOpen, entry]);

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
            await ClientConnect.update(entry.id, form);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error updating client connect entry:', err);
            setError(err.message || 'Failed to update entry');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[rgb(var(--card))] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-lg mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)] max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[rgb(var(--card))] z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-heading-primary">Edit Client Connect</h2>
                        <p className="text-sm text-heading-subdued mt-1">Update prospective client details</p>
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="company" className="text-heading-primary">Company</Label>
                            <Input
                                id="company"
                                name="company"
                                value={form.company}
                                onChange={handleChange}
                                placeholder="Company name"
                                className="rounded-xl"
                            />
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
                        <Label htmlFor="location" className="text-heading-primary">Location / County</Label>
                        <Select value={form.location} onValueChange={(val) => setForm(prev => ({ ...prev, location: val }))}>
                            <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select county" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(countiesData).map(([state, counties]) => (
                                    counties.map(county => (
                                        <SelectItem key={`${state}-${county}`} value={`${county}, ${state}`}>{county}, {state}</SelectItem>
                                    ))
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                        <h3 className="text-sm font-medium text-heading-subdued uppercase tracking-wider mb-3">Caregiver Information</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="caregiver_name" className="text-heading-primary">Caregiver Name</Label>
                            <Input
                                id="caregiver_name"
                                name="caregiver_name"
                                value={form.caregiver_name}
                                onChange={handleChange}
                                placeholder="Caregiver's full name"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="relationship" className="text-heading-primary">Relationship</Label>
                            <Select value={form.relationship} onValueChange={(val) => setForm(prev => ({ ...prev, relationship: val }))}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Select relationship" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CAREGIVER_RELATIONSHIPS.map(r => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="caregiver_email" className="text-heading-primary">Caregiver Email</Label>
                            <Input
                                id="caregiver_email"
                                name="caregiver_email"
                                type="email"
                                value={form.caregiver_email}
                                onChange={handleChange}
                                placeholder="email@example.com"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="caregiver_phone" className="text-heading-primary">Caregiver Phone</Label>
                            <Input
                                id="caregiver_phone"
                                name="caregiver_phone"
                                value={form.caregiver_phone}
                                onChange={(e) => setForm(prev => ({ ...prev, caregiver_phone: formatPhone(e.target.value) }))}
                                placeholder="(555) 123-4567"
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pay_rate" className="text-heading-primary">Pay Rate</Label>
                        <Input
                            id="pay_rate"
                            name="pay_rate"
                            value={form.pay_rate}
                            onChange={handleChange}
                            placeholder="Pay rate"
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
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
