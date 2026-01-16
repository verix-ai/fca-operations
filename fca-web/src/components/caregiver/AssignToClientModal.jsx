import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search, User, Loader2, AlertTriangle } from 'lucide-react';
import { Client } from '@/entities/Client.supabase';
import { ClientCaregiver } from '@/entities/ClientCaregiver.supabase';
import { supabase } from '@/lib/supabase';

export default function AssignToClientModal({ isOpen, onClose, caregiver, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState(null);
    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [confirmConflict, setConfirmConflict] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadClients();
        }
    }, [isOpen]);

    const loadClients = async () => {
        setLoading(true);
        try {
            // Fetch clients with their active caregivers
            const { data, error } = await supabase
                .from('clients')
                .select(`
                    *,
                    caregivers:client_caregivers(id, full_name, status)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setClients(data);
        } catch (err) {
            console.error('Error loading clients:', err);
            setError('Failed to load clients');
        } finally {
            setLoading(false);
        }
    };

    const filteredClients = clients.filter(client =>
        client.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const proceedWithAssignment = async () => {
        setAssigning(true);
        setError(null);

        try {
            await ClientCaregiver.assignToClient(caregiver.id, selectedClient.id);
            onSuccess?.(selectedClient);
            onClose();
        } catch (err) {
            console.error('Error assigning caregiver:', err);
            setError(err.message || 'Failed to assign caregiver');
            setAssigning(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedClient || !caregiver) return;

        // Check for active caregiver conflict
        const activeCaregiver = selectedClient.caregivers?.find(c => c.status === 'active');
        if (activeCaregiver) {
            setConfirmConflict({
                client: selectedClient,
                caregiver: activeCaregiver
            });
            return;
        }

        await proceedWithAssignment();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[rgb(var(--card))] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-lg mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)] max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-semibold text-heading-primary">
                            {confirmConflict ? 'Confirm Reassignment' : 'Assign to Client'}
                        </h2>
                        {!confirmConflict && (
                            <p className="text-sm text-heading-subdued mt-1">
                                Select a client to assign <span className="text-brand">{caregiver?.full_name}</span> to
                            </p>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {confirmConflict ? (
                    <div className="p-6 space-y-6">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-4">
                            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                            <div className="space-y-2">
                                <h3 className="font-semibold text-amber-500">Caregiver Already Assigned</h3>
                                <p className="text-sm text-amber-200/80 leading-relaxed">
                                    <span className="font-medium text-amber-100">{confirmConflict.client.client_name}</span> already has an active caregiver assigned:
                                </p>
                                <div className="bg-black/20 rounded-lg p-3 border border-amber-500/20">
                                    <div className="font-medium text-amber-100">{confirmConflict.caregiver.full_name}</div>
                                    <div className="text-xs text-amber-200/60 uppercase tracking-widest mt-1">Active</div>
                                </div>
                                <p className="text-sm text-amber-200/80 pt-2">
                                    Proceeding will <span className="text-amber-100 font-medium">deactivate</span> the current caregiver and assign {caregiver?.full_name} instead.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => setConfirmConflict(null)}
                                disabled={assigning}
                            >
                                Back
                            </Button>
                            <Button
                                variant="destructive"
                                className="rounded-full"
                                onClick={proceedWithAssignment}
                                disabled={assigning}
                            >
                                {assigning ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Reassigning...
                                    </>
                                ) : (
                                    'Confirm & Reassign'
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Search */}
                        <div className="p-4 border-b border-white/5 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brand/80 w-4 h-4" />
                                <Input
                                    placeholder="Search clients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="rounded-xl pl-12"
                                />
                            </div>
                        </div>

                        {/* Client List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand" />
                                </div>
                            ) : filteredClients.length === 0 ? (
                                <div className="text-center py-12 text-heading-subdued">
                                    {searchTerm ? 'No clients match your search' : 'No clients available'}
                                </div>
                            ) : (
                                filteredClients.map((client) => {
                                    const activeCaregiver = client.caregivers?.find(c => c.status === 'active');
                                    return (
                                        <button
                                            key={client.id}
                                            type="button"
                                            onClick={() => setSelectedClient(client)}
                                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${selectedClient?.id === client.id
                                                ? 'bg-brand/10 border-brand/40 ring-2 ring-brand/20'
                                                : 'bg-black/10 border-[rgba(147,165,197,0.25)] hover:border-brand/30'
                                                }`}
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 border border-brand/20">
                                                <User className="w-5 h-5 text-brand" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-semibold text-heading-primary truncate">
                                                        {client.client_name}
                                                    </div>
                                                    {activeCaregiver && (
                                                        <div className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                            Has Active Caregiver
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-xs text-heading-subdued truncate">
                                                    {client.location || 'No location'}
                                                    {client.program && ` • ${client.program}`}
                                                </div>
                                            </div>
                                            {selectedClient?.id === client.id && (
                                                <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t border-white/5 flex justify-end gap-3 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-full"
                                onClick={onClose}
                                disabled={assigning}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                className="rounded-full"
                                onClick={handleAssign}
                                disabled={!selectedClient || assigning}
                            >
                                {assigning ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Assigning...
                                    </>
                                ) : (
                                    'Assign Caregiver'
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
