import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClientCaregiver } from "@/entities/ClientCaregiver.supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, User, Heart, Home, AlertTriangle, MessageSquare, Pencil, X, FileText, ClipboardCheck } from "lucide-react";
import SectionHeader from "@/components/layout/SectionHeader.jsx";
import ContactModal from "@/components/client/ContactModal";
import { createPageUrl, formatPhone } from "@/utils";
import { format, isBefore, addDays, addYears } from "date-fns";
import SettingsStore from '@/entities/Settings.supabase';
import { useAuth } from "@/auth/AuthProvider.jsx";
import CaregiverOnboardingChecklist from "@/components/caregiver/CaregiverOnboardingChecklist.jsx";
import CaregiverCompliance from "@/components/caregiver/CaregiverCompliance.jsx";
import AssignToClientModal from "@/components/caregiver/AssignToClientModal.jsx";
import ProfileImageUpload from "@/components/ui/ProfileImageUpload";
import { CAREGIVER_RELATIONSHIPS } from "../constants/caregiver.js";

const InfoRow = ({ icon: Icon, label, value, status }) => {
    if (!value) return null;

    let borderColor = 'border-white/5';
    let bgColor = 'bg-black/10';
    let iconColor = 'text-brand/70';
    let labelColor = 'text-heading-subdued';
    let valueColor = '';

    if (status === 'warning') {
        borderColor = 'border-amber-500/30';
        bgColor = 'bg-amber-500/10';
        iconColor = 'text-amber-500';
        labelColor = 'text-amber-200';
        valueColor = 'text-amber-100';
    } else if (status === 'error') {
        borderColor = 'border-red-500/30';
        bgColor = 'bg-red-500/10';
        iconColor = 'text-red-500';
        labelColor = 'text-red-200';
        valueColor = 'text-red-100';
    }

    return (
        <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${borderColor} ${bgColor}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
            <div className={`text-xs uppercase tracking-[0.3em] ${labelColor}`}>{label}</div>
            <div className={`text-heading-primary text-sm font-medium truncate ml-auto ${valueColor}`}>{value}</div>
        </div>
    );
};

export default function CaregiverDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [caregiver, setCaregiver] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [contactModal, setContactModal] = useState({ open: false, channel: 'email' });
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    const loadCaregiver = useCallback(async () => {
        setIsLoading(true);
        try {
            if (id) {
                const data = await ClientCaregiver.get(id);
                setCaregiver(data);
            }
        } catch (error) {
            console.error("Error loading caregiver:", error);
        }
        setIsLoading(false);
    }, [id]);

    useEffect(() => {
        loadCaregiver();
    }, [loadCaregiver]);

    const [settings, setSettings] = useState(null);
    useEffect(() => {
        SettingsStore.get().then(s => {
            if (s?.caregiver_alerts) setSettings(s.caregiver_alerts);
        }).catch(console.error);
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
                    <p className="text-heading-subdued uppercase tracking-[0.3em] text-xs">Loading profile</p>
                </div>
            </div>
        );
    }

    if (!caregiver) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-heading-subdued">Caregiver not found</p>
                    <Button
                        variant="default"
                        borderRadius="999px"
                        className="gap-2 px-6"
                        onClick={() => navigate(createPageUrl("CaregiverList"))}
                    >
                        Return to List
                    </Button>
                </div>
            </div>
        );
    }

    const getStatus = (expirationDate, daysThreshold = 30) => {
        if (!expirationDate) return 'ok';
        const now = new Date();
        if (isBefore(expirationDate, now)) return 'error';
        if (isBefore(expirationDate, addDays(now, daysThreshold))) return 'warning';
        return 'ok';
    };

    const openEditModal = () => {
        setEditForm({
            full_name: caregiver.full_name || '',
            relationship: caregiver.relationship || undefined,
            phone: caregiver.phone || '',
            email: caregiver.email || '',
            lives_in_home: Boolean(caregiver.lives_in_home),
            notes: caregiver.notes || '',
        });
        setEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        try {
            await ClientCaregiver.updateCaregiver(caregiver.id, editForm);
            setCaregiver(prev => ({ ...prev, ...editForm }));
            setEditModalOpen(false);
        } catch (error) {
            console.error('Error updating caregiver:', error);
        }
        setSaving(false);
    };

    const client = caregiver?.client || {};
    // Read expiration dates from caregiver record first (new), then fallback to client record (legacy)
    const cprIssuedAt = caregiver.cpr_issued_at || client.cpr_issued_at;
    const tbIssuedAt = caregiver.tb_test_issued_at || client.tb_test_issued_at;
    const licenseExpiresAt = caregiver.drivers_license_expires_at || client.drivers_license_expires_at;
    const trainingDate = client.training_or_care_start_date; // Training stays on client for now

    const cprExpiration = cprIssuedAt ? addYears(new Date(cprIssuedAt), 2) : null;
    const tbExpiration = tbIssuedAt ? addYears(new Date(tbIssuedAt), 1) : null;
    const trainingExpiration = trainingDate ? addYears(new Date(trainingDate), 1) : null;
    const licenseExpiration = licenseExpiresAt ? new Date(licenseExpiresAt) : null;

    return (
        <div className="space-y-10">
            <div className="space-y-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-stretch gap-6">
                    <Button
                        variant="outline"
                        size="icon"
                        borderRadius="1.25rem"
                        onClick={() => navigate(createPageUrl("CaregiverList"))}
                        className="rounded-2xl"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <SectionHeader
                        eyebrow="Caregiver Profile"
                        title={caregiver.full_name}
                        media={(
                            <ProfileImageUpload
                                imageUrl={caregiver.profile_image_url}
                                entityId={caregiver.id}
                                entityType="caregiver"
                                onUpload={async (url) => {
                                    await ClientCaregiver.updateCaregiver(caregiver.id, { profile_image_url: url });
                                    setCaregiver(prev => ({ ...prev, profile_image_url: url }));
                                }}
                                readOnly={user?.role === 'marketer'}
                                size="lg"
                            />
                        )}
                        description={caregiver.started_at ? `Started ${format(new Date(caregiver.started_at), 'MMM d, yyyy')}` : undefined}
                    >
                        <div className="flex flex-wrap items-center gap-4 text-heading-subdued">
                            <Badge className={caregiver.status === 'active' ? "bg-brand/15 text-brand border-brand/40" : "bg-white/5 text-neutral-400 border-white/10"}>
                                {caregiver.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="flex items-center gap-2 uppercase tracking-[0.3em] text-xs">
                                {caregiver.status === 'inactive' ? (
                                    <Badge className="bg-neutral-500/20 text-neutral-300 border-neutral-500/30">
                                        Deactivated
                                    </Badge>
                                ) : caregiver.client?.client_name ? (
                                    <>Assigned to: {caregiver.client.client_name}</>
                                ) : (
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                                        Unassigned
                                    </Badge>
                                )}
                            </span>
                            <div className="flex gap-2 ml-auto">
                                {caregiver.email && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 text-brand border-brand/40 hover:bg-brand/10"
                                        onClick={() => setContactModal({ open: true, channel: 'email' })}
                                    >
                                        <Mail className="w-4 h-4" />
                                        Email
                                    </Button>
                                )}
                                {caregiver.phone && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 text-brand border-brand/40 hover:bg-brand/10"
                                        onClick={() => setContactModal({ open: true, channel: 'sms' })}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Text
                                    </Button>
                                )}
                            </div>
                        </div>
                    </SectionHeader>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <TabsList className="bg-hero-card p-2 rounded-3xl border border-[rgba(147,165,197,0.25)] backdrop-blur-xl inline-flex w-auto min-w-full md:w-full">
                            <TabsTrigger
                                value="overview"
                                className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger
                                value="compliance"
                                className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
                            >
                                <ClipboardCheck className="w-4 h-4 mr-2" />
                                Compliance
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview">
                        <div className="grid md:grid-cols-3 gap-8">
                    {/* Main Info */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border border-[rgba(96,255,168,0.18)] rounded-3xl">
                            <CardHeader className="border-b border-white/5 p-6 flex flex-row items-center justify-between">
                                <CardTitle className="text-lg font-semibold text-heading-primary flex items-center gap-2">
                                    <User className="w-5 h-5 text-brand/70" />
                                    Details
                                </CardTitle>
                                <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={openEditModal}>
                                    <Pencil className="w-4 h-4" />
                                    Edit
                                </Button>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <InfoRow icon={User} label="Relationship" value={caregiver.relationship || '-'} />
                                    <InfoRow icon={Home} label="Lives In Home" value={caregiver.lives_in_home ? 'Yes' : 'No'} />
                                    <InfoRow icon={Phone} label="Phone" value={caregiver.phone || '-'} />
                                    <InfoRow icon={Mail} label="Email" value={caregiver.email || '-'} />
                                    <InfoRow icon={Calendar} label="Start Date" value={caregiver.started_at ? format(new Date(caregiver.started_at), 'MMM d, yyyy') : '-'} />
                                    <InfoRow icon={Calendar} label="End Date" value={caregiver.ended_at ? format(new Date(caregiver.ended_at), 'MMM d, yyyy') : '-'} />
                                </div>

                                {caregiver.notes && (
                                    <div className="mt-6 pt-6 border-t border-white/5 space-y-2">
                                        <h4 className="text-xs uppercase tracking-[0.3em] text-heading-subdued">Notes</h4>
                                        <p className="text-sm text-heading-primary leading-relaxed bg-black/20 p-4 rounded-2xl border border-white/5">
                                            {caregiver.notes}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Onboarding Checklist - for all caregivers */}
                        <CaregiverOnboardingChecklist
                            caregiver={caregiver}
                            onUpdate={(updates) => setCaregiver(prev => ({ ...prev, ...updates }))}
                        />

                        <Card className="border border-[rgba(96,255,168,0.18)] rounded-3xl">
                            <CardHeader className="border-b border-white/5 p-6">
                                <CardTitle className="text-lg font-semibold text-heading-primary flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-brand/70" />
                                    Expiration Dates
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <InfoRow
                                        icon={getStatus(cprExpiration, settings?.cpr_days) !== 'ok' ? AlertTriangle : Calendar}
                                        label="CPR | First Aid Expires"
                                        value={cprExpiration ? format(cprExpiration, "MMM d, yyyy") : null}
                                        status={getStatus(cprExpiration, settings?.cpr_days)}
                                    />
                                    <InfoRow
                                        icon={getStatus(tbExpiration, settings?.tb_days) !== 'ok' ? AlertTriangle : Calendar}
                                        label="TB Test Expires"
                                        value={tbExpiration ? format(tbExpiration, "MMM d, yyyy") : null}
                                        status={getStatus(tbExpiration, settings?.tb_days)}
                                    />
                                    <InfoRow
                                        icon={getStatus(licenseExpiration, settings?.drivers_license_days) !== 'ok' ? AlertTriangle : Calendar}
                                        label="License Expires"
                                        value={licenseExpiration ? format(licenseExpiration, "MMM d, yyyy") : null}
                                        status={getStatus(licenseExpiration, settings?.drivers_license_days)}
                                    />
                                    <InfoRow
                                        icon={getStatus(trainingExpiration, settings?.training_days) !== 'ok' ? AlertTriangle : Calendar}
                                        label="Training Expires"
                                        value={trainingExpiration ? format(trainingExpiration, "MMM d, yyyy") : null}
                                        status={getStatus(trainingExpiration, settings?.training_days)}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar / Linked Client */}
                    <div className="space-y-6">
                        <Card className="border border-[rgba(96,255,168,0.18)] rounded-3xl">
                            <CardHeader className="border-b border-white/5 p-6">
                                <CardTitle className="text-lg font-semibold text-heading-primary flex items-center gap-2">
                                    <User className="w-5 h-5 text-brand/70" />
                                    Assigned Client
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {caregiver.status === 'inactive' ? (
                                    <div className="space-y-4">
                                        <p className="text-heading-subdued">This caregiver has been deactivated.</p>
                                        {caregiver.client && (
                                            <div className="text-sm text-heading-subdued">
                                                Previously assigned to: <span className="text-heading-primary">{caregiver.client.client_name}</span>
                                            </div>
                                        )}
                                        <Button
                                            variant="default"
                                            className="w-full gap-2 rounded-full"
                                            onClick={() => setAssignModalOpen(true)}
                                        >
                                            Reassign to Client
                                        </Button>
                                    </div>
                                ) : caregiver.client ? (
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.3em] text-heading-subdued mb-1">Client Name</div>
                                            <div className="text-xl font-semibold text-heading-primary">{caregiver.client.client_name}</div>
                                        </div>
                                        <div className="pt-4 border-t border-white/5">
                                            <Button
                                                variant="outline"
                                                className="w-full justify-between group"
                                                onClick={() => navigate(createPageUrl('ClientDetail', { id: caregiver.client.id }))}
                                            >
                                                View Client Profile
                                                <ArrowLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-heading-subdued">No client assigned yet.</p>
                                        <Button
                                            variant="default"
                                            className="w-full gap-2 rounded-full"
                                            onClick={() => setAssignModalOpen(true)}
                                        >
                                            Assign to Client
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="compliance">
                        <CaregiverCompliance
                            caregiver={caregiver}
                            onUpdate={async (updates) => {
                                await ClientCaregiver.updateCaregiver(caregiver.id, updates);
                                setCaregiver(prev => ({ ...prev, ...updates }));
                            }}
                            readOnly={user?.role === 'marketer'}
                        />
                    </TabsContent>
                </Tabs>

            </div>

            {/* Contact Modal */}
            <ContactModal
                isOpen={contactModal.open}
                onClose={() => setContactModal({ ...contactModal, open: false })}
                recipient={{ name: caregiver?.full_name, email: caregiver?.email, phone: caregiver?.phone }}
                recipientType="caregiver"
                recipientId={caregiver?.id}
                defaultChannel={contactModal.channel}
            />

            {/* Assign to Client Modal */}
            <AssignToClientModal
                isOpen={assignModalOpen}
                onClose={() => setAssignModalOpen(false)}
                caregiver={caregiver}
                onSuccess={(client) => {
                    // Navigate to the client detail page after successful assignment
                    navigate(createPageUrl('ClientDetail', { id: client.id }));
                }}
            />

            {/* Edit Caregiver Modal */}
            {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditModalOpen(false)} />
                    <div className="relative bg-[rgb(var(--card))] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-lg mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-heading-primary">Edit Caregiver</h2>
                                <p className="text-sm text-heading-subdued mt-1">Update caregiver information</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setEditModalOpen(false)} className="rounded-xl">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-heading-primary">Full Name</Label>
                                <Input
                                    value={editForm.full_name}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-heading-primary">Relationship</Label>
                                    <Select value={editForm.relationship || undefined} onValueChange={(val) => setEditForm(prev => ({ ...prev, relationship: val }))}>
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
                                <div className="space-y-2">
                                    <Label className="text-heading-primary">Phone</Label>
                                    <Input
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                                        placeholder="(555) 123-4567"
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-heading-primary">Email</Label>
                                    <Input
                                        value={editForm.email}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                        type="email"
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-heading-primary">Lives in Home</Label>
                                    <Select value={editForm.lives_in_home ? "yes" : "no"} onValueChange={(val) => setEditForm(prev => ({ ...prev, lives_in_home: val === "yes" }))}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-heading-primary">Notes</Label>
                                <Textarea
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="rounded-xl min-h-[80px]"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="button" className="rounded-full" onClick={handleSaveEdit} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
