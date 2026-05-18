import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Check, Loader2 } from 'lucide-react';
import { ClientCaregiver } from '@/entities/ClientCaregiver.supabase';
import { COMPLIANCE_ONBOARDING_MAP } from "@/constants/caregiver";

// Define the onboarding checklist items. Items with a `dates` array render
// paired Issued/Expires inputs that remain editable even after finalization.
const ONBOARDING_ITEMS = [
    { field: 'viventium_onboarding_completed', label: 'Viventium Onboarding Complete' },
    { field: 'background_results_uploaded', label: 'Background Results Received & Uploaded' },
    { field: 'ssn_or_birth_certificate_submitted', label: 'SSN/Birth Certificate Submitted' },
    { field: 'pca_cert_including_2_of_3', label: 'PCA Cert (2/3)' },
    {
        field: 'drivers_license_submitted',
        label: 'Driver\'s License Submitted',
        dates: [
            { field: 'drivers_license_issued_at', label: 'Issued' },
            { field: 'drivers_license_expires_at', label: 'Expires' },
        ],
    },
    {
        field: 'tb_test_completed',
        label: 'TB Test Completed',
        dates: [
            { field: 'tb_test_issued_at', label: 'Issued' },
            { field: 'tb_test_expires_at', label: 'Expires' },
        ],
    },
    {
        field: 'cpr_first_aid_completed',
        label: 'CPR/First Aid Completed',
        dates: [
            { field: 'cpr_issued_at', label: 'Issued' },
            { field: 'cpr_expires_at', label: 'Expires' },
        ],
    },
    {
        field: 'caregiver_training_completed',
        label: 'Caregiver Training Completed',
        dates: [
            { field: 'caregiver_training_date', label: 'Issued' },
            { field: 'caregiver_training_expires_at', label: 'Expires' },
        ],
    },
    {
        field: 'caregiver_fingerprinted',
        label: 'Caregiver Fingerprinted',
        dates: [
            { field: 'caregiver_fingerprinted_at', label: 'Issued' },
            { field: 'fingerprint_expires_at', label: 'Expires' },
        ],
    },
];

export default function CaregiverOnboardingChecklist({ caregiver, onUpdate }) {
    const [updating, setUpdating] = React.useState(null);

    if (!caregiver) return null;

    const completedCount = ONBOARDING_ITEMS.filter(item => caregiver[item.field]).length;
    const progress = Math.round((completedCount / ONBOARDING_ITEMS.length) * 100);
    const isFinalized = caregiver.onboarding_finalized;



    // ...

    const handleToggle = async (field, value) => {
        setUpdating(field);

        let updates = { [field]: value };

        // Sync with Compliance Data
        // Find if this field maps to a compliance item
        const complianceId = Object.keys(COMPLIANCE_ONBOARDING_MAP).find(
            key => COMPLIANCE_ONBOARDING_MAP[key] === field
        );

        if (complianceId) {
            const currentComplianceData = caregiver.compliance_data || {};
            const itemData = currentComplianceData[complianceId] || {};

            updates.compliance_data = {
                ...currentComplianceData,
                [complianceId]: {
                    ...itemData,
                    checked: value
                }
            };
        }

        try {
            await ClientCaregiver.updateCaregiver(caregiver.id, updates);
            onUpdate?.(updates);
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
                    const dateFields = item.dates || [];
                    const isUpdating =
                        updating === item.field ||
                        dateFields.some((d) => updating === d.field);

                    return (
                        <div
                            key={item.field}
                            className={`${dateFields.length ? 'flex flex-col gap-2' : 'flex items-center gap-3'} bg-black/10 px-4 py-3 rounded-2xl border border-[rgba(147,165,197,0.25)]`}
                        >
                            <div className={`flex items-center gap-3 ${isFinalized ? 'opacity-60' : ''}`}>
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

                            {dateFields.length > 0 && (
                                <div className="ml-8 mt-1 flex flex-wrap gap-3">
                                    {dateFields.map((d) => (
                                        <div key={d.field}>
                                            <Input
                                                type="date"
                                                value={caregiver[d.field] || ''}
                                                onChange={(e) => handleDateChange(d.field, e.target.value)}
                                                className="h-9 text-xs rounded-lg w-full max-w-[180px]"
                                            />
                                            <p className="text-[10px] text-heading-subdued mt-1 uppercase tracking-wider">{d.label}</p>
                                        </div>
                                    ))}
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
