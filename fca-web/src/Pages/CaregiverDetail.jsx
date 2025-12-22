
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClientCaregiver } from "@/entities/ClientCaregiver.supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, User, Heart, Home, AlertTriangle, MessageSquare } from "lucide-react";
import SectionHeader from "@/components/layout/SectionHeader.jsx";
import ContactModal from "@/components/client/ContactModal";
import { createPageUrl } from "@/utils";
import { format, isBefore, addDays, addYears } from "date-fns";
import SettingsStore from '@/entities/Settings.supabase';
import { useAuth } from "@/auth/AuthProvider.jsx";

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

    const client = caregiver?.client || {};
    const cprExpiration = client.cpr_issued_at ? addYears(new Date(client.cpr_issued_at), 2) : null;
    const tbExpiration = client.tb_test_issued_at ? addYears(new Date(client.tb_test_issued_at), 1) : null;
    const trainingExpiration = client.training_or_care_start_date ? addYears(new Date(client.training_or_care_start_date), 1) : null;
    const licenseExpiration = client.drivers_license_expires_at ? new Date(client.drivers_license_expires_at) : null;

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
                            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-client-avatar shadow-[0_24px_45px_-28px_rgba(96,255,168,0.35)]">
                                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand/40 via-transparent to-aqua-600/40 blur-xl" />
                                <Heart className="relative h-10 w-10 text-icon-primary" />
                            </div>
                        )}
                        description={caregiver.started_at ? `Started ${format(new Date(caregiver.started_at), 'MMM d, yyyy')}` : undefined}
                    >
                        <div className="flex flex-wrap items-center gap-4 text-heading-subdued">
                            <Badge className={caregiver.status === 'active' ? "bg-brand/15 text-brand border-brand/40" : "bg-white/5 text-neutral-400 border-white/10"}>
                                {caregiver.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="flex items-center gap-2 uppercase tracking-[0.3em] text-xs">
                                Assigned to: {caregiver.client?.client_name || 'Unknown'}
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

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Main Info */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border border-[rgba(96,255,168,0.18)] rounded-3xl">
                            <CardHeader className="border-b border-white/5 p-6">
                                <CardTitle className="text-lg font-semibold text-heading-primary flex items-center gap-2">
                                    <User className="w-5 h-5 text-brand/70" />
                                    Details
                                </CardTitle>
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
                                {caregiver.client ? (
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
                                    <p className="text-heading-subdued">No client assigned.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

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
        </div>
    );
}
