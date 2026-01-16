import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Check, Loader2 } from 'lucide-react';
import { ClientCaregiver } from '@/entities/ClientCaregiver.supabase';

// Define the onboarding checklist items
const ONBOARDING_ITEMS = [
    { field: 'viventium_onboarding_completed', label: 'Viventium Onboarding Complete' },
    { field: 'caregiver_fingerprinted', label: 'Caregiver Fingerprinted' },
    { field: 'background_results_uploaded', label: 'Background Results Received & Uploaded' },
    { field: 'ssn_or_birth_certificate_submitted', label: 'SSN/Birth Certificate Submitted' },
    { field: 'pca_cert_including_2_of_3', label: 'PCA Cert (2/3)' },
    { field: 'drivers_license_submitted', label: 'Driver\'s License Submitted', dateField: 'drivers_license_expires_at', dateLabel: 'Expires' },
    { field: 'tb_test_completed', label: 'TB Test Completed', dateField: 'tb_test_issued_at', dateLabel: 'Issued' },
    { field: 'cpr_first_aid_completed', label: 'CPR/First Aid Completed', dateField: 'cpr_issued_at', dateLabel: 'Issued' },
];

export default function CaregiverOnboardingChecklist({ caregiver, onUpdate }) {
    const [updating, setUpdating] = React.useState(null);

    if (!caregiver) return null;

    const completedCount = ONBOARDING_ITEMS.filter(item => caregiver[item.field]).length;
    const progress = Math.round((completedCount / ONBOARDING_ITEMS.length) * 100);
    const isFinalized = caregiver.onboarding_finalized;

    const handleToggle = async (field, value) => {
        setUpdating(field);
        try {
            await ClientCaregiver.updateCaregiver(caregiver.id, { [field]: value });
            onUpdate?.({ [field]: value });
        } catch (err) {
            console.error('Failed to update:', err);
        } finally {
            setUpdating(null);
        }
    };

    const handleDateChange = async (field, value) => {
        setUpdating(field);
        try {
            await ClientCaregiver.updateCaregiver(caregiver.id, { [field]: value || null });
            onUpdate?.({ [field]: value || null });
        } catch (err) {
            console.error('Failed to update date:', err);
        } finally {
            setUpdating(null);
        }
    };

    const handleFinalize = async () => {
        if (completedCount < ONBOARDING_ITEMS.length) {
            return; // Don't finalize if not all items are complete
        }
        setUpdating('finalize');
        try {
            await ClientCaregiver.updateCaregiver(caregiver.id, { onboarding_finalized: true });
            onUpdate?.({ onboarding_finalized: true });
        } catch (err) {
            console.error('Failed to finalize:', err);
        } finally {
            setUpdating(null);
        }
    };

    return (
        <Card className="border border-[rgba(96,255,168,0.18)] rounded-3xl">
            <CardHeader className="border-b border-white/5 p-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-heading-primary flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-brand/70" />
                        Caregiver Onboarding
                    </CardTitle>
                    {isFinalized ? (
                        <Badge className="bg-brand/20 text-brand border-brand/40">
                            <Check className="w-3 h-3 mr-1" />
                            Finalized
                        </Badge>
                    ) : (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                            {progress}% Complete
                        </Badge>
                    )}
                </div>
                {/* Progress bar */}
                <div className="mt-4 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-brand to-aqua-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-3">
                {ONBOARDING_ITEMS.map((item) => {
                    const checked = Boolean(caregiver[item.field]);
                    const isUpdating = updating === item.field || updating === item.dateField;

                    return (
                        <div
                            key={item.field}
                            className={`${item.dateField ? 'flex flex-col gap-2' : 'flex items-center gap-3'} bg-black/10 px-4 py-3 rounded-2xl border border-[rgba(147,165,197,0.25)] ${isFinalized ? 'opacity-60' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                {isUpdating ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-brand" />
                                ) : (
                                    <Checkbox
                                        checked={checked}
                                        disabled={isFinalized}
                                        onCheckedChange={(val) => handleToggle(item.field, Boolean(val))}
                                        className={`rounded-lg ${checked ? "data-[state=checked]:bg-brand data-[state=checked]:border-brand shadow-[0_0_0_3px_rgba(96,255,168,0.12)]" : ""}`}
                                    />
                                )}
                                <span className={`text-sm ${checked ? "text-heading-primary font-semibold" : "text-heading-subdued"}`}>
                                    {item.label}
                                </span>
                            </div>

                            {item.dateField && (
                                <div className="ml-8 mt-1">
                                    <Input
                                        type="date"
                                        value={caregiver[item.dateField] || ''}
                                        onChange={(e) => handleDateChange(item.dateField, e.target.value)}
                                        disabled={isFinalized}
                                        className="h-9 text-xs rounded-lg w-full max-w-[200px]"
                                    />
                                    <p className="text-[10px] text-heading-subdued mt-1 uppercase tracking-wider">{item.dateLabel}</p>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Finalize Button */}
                {!isFinalized && completedCount === ONBOARDING_ITEMS.length && (
                    <div className="pt-4 border-t border-white/5">
                        <Button
                            variant="default"
                            borderRadius="999px"
                            className="w-full gap-2"
                            onClick={handleFinalize}
                            disabled={updating === 'finalize'}
                        >
                            {updating === 'finalize' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            Finalize Onboarding
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
