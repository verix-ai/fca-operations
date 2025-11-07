import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui";
import { User, MapPin, Calendar, DollarSign, Phone, Mail, Heart, Clock } from "lucide-react";
import PhaseProgress from "./PhaseProgress";
import { format } from "date-fns";
import { useToast } from "@/components/ui/toast.jsx";

const phaseCheckboxes = {
  intake: [
    { field: 'initial_assessment_required', label: 'Initial Assessment?' },
    { field: 'clinical_dates_entered', label: 'Clinical Dates Entered?' },
    { field: 'reassessment_date_entered', label: 'Re-Assessment Date Entered?' },
    { field: 'initial_assessment_completed', label: 'Initial Assessment Completed?' },
    { field: 'client_documents_populated', label: 'Client Documents Populated?' }
  ],
  onboarding: [
    { field: 'viventium_onboarding_completed', label: 'Viventium Onboarding Complete?' },
    { field: 'caregiver_fingerprinted', label: 'Caregiver has been Finger Printed?' },
    { field: 'background_results_uploaded', label: 'Background Results Received & Uploaded?' },
    { field: 'drivers_license_submitted', label: 'Drivers License Submitted?' },
    { field: 'ssn_or_birth_certificate_submitted', label: 'Social Security and/or Birth Certificate Submitted?' },
    { field: 'tb_test_completed', label: 'Completed TB Test?' },
    { field: 'cpr_first_aid_completed', label: 'Completed CPR/First Aid?' },
    { field: 'pca_cert_including_2_of_3', label: 'PCA Cert incl 2/3' }
  ],
  service_initiation: [
    { field: 'edwp_created_and_sent', label: 'Start Of EDWP Created & Sent to Case Manager?' },
    { field: 'edwp_transmittal_completed', label: 'EDWP Transmittal?' },
    { field: 'manager_ccd', label: "Was Manager CC'd?" },
    { field: 'schedule_created_and_extended_until_aed', label: 'Was Schedule Created & Extended until AED?' }
  ]
};

const phaseLabels = {
  intake: 'Client Intake',
  onboarding: 'Onboarding',
  service_initiation: 'Service Initiation'
};

const programColors = {
  PSS: 'bg-[rgba(96,255,168,0.14)] text-heading-primary border-brand/35',
  PCA: 'bg-[rgba(51,241,255,0.16)] text-heading-primary border-[rgba(51,241,255,0.35)]',
  'Companion Care': 'bg-[rgba(96,255,168,0.14)] text-heading-primary border-brand/35',
  'Respite Care': 'bg-[rgba(51,241,255,0.16)] text-heading-primary border-[rgba(51,241,255,0.35)]'
};

export default function ClientOverview({ client, onUpdate, readOnly = false }) {
  const { push } = useToast();
  const currentPhaseCheckboxes = phaseCheckboxes[client.current_phase] || [];

  const clientPhone = client.client_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[0] : null)
  const caregiverPhone = client.caregiver_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[1] : null)

  const handleCheckboxChange = async (field, checked) => {
    if (readOnly) return;
    await onUpdate({ [field]: checked });
    const allDone = currentPhaseCheckboxes.every(cb => (cb.field === field ? checked : client[cb.field]));
    if (allDone) {
      push({ title: 'All items complete. Click Submit to finalize this phase.' });
    }
  };

  return (
    <>
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Client Information */}
      <Card className="border border-[rgba(96,255,168,0.18)]">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-heading-primary text-xl flex items-center gap-3 tracking-tight">
            <User className="w-5 h-5 text-brand/70" />
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-3xl bg-client-avatar border border-white/10 flex items-center justify-center shadow-[0_24px_45px_-28px_rgba(96,255,168,0.35)]">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand/35 via-transparent to-aqua-600/35 blur-xl" />
                <User className="relative w-6 h-6 text-icon-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-heading-primary tracking-tight">{client.client_name}</h3>
                <Badge className={`${programColors[client.program]} px-3 py-1 rounded-xl font-medium mt-2`}>
                  {client.program}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {client.location && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <MapPin className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Location</span>
                  <span className="text-heading-primary">{client.location}</span>
                </div>
              )}

              {client.frequency && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <Calendar className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Frequency</span>
                  <span className="text-heading-primary">{client.frequency}</span>
                </div>
              )}

              {client.cost_share_amount && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <DollarSign className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Cost Share</span>
                  <span className="text-heading-primary">${client.cost_share_amount}</span>
                </div>
              )}

              {client.intake_date && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <Clock className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Intake</span>
                  <span className="text-heading-primary">{format(new Date(client.intake_date), 'MMMM d, yyyy')}</span>
                </div>
              )}

              {clientPhone && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <Phone className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Phone</span>
                  <span className="text-heading-primary">{clientPhone}</span>
                </div>
              )}

              {client.director_of_marketing && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <User className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Marketing Director</span>
                  <span className="text-heading-primary">{client.director_of_marketing}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Caregiver Information */}
      <Card className="border border-[rgba(96,255,168,0.18)]">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-heading-primary text-xl flex items-center gap-3 tracking-tight">
            <Heart className="w-5 h-5 text-brand/70" />
            Caregiver Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-3xl bg-client-avatar border border-white/10 flex items-center justify-center shadow-[0_24px_45px_-28px_rgba(96,255,168,0.35)]">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand/35 via-transparent to-aqua-600/35 blur-xl" />
                <Heart className="relative w-6 h-6 text-icon-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-heading-primary tracking-tight">{client.caregiver_name}</h3>
                <p className="text-heading-subdued uppercase tracking-[0.3em] text-xs">{client.caregiver_relationship}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {client.email && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <Mail className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Email</span>
                  <span className="text-heading-primary">{client.email}</span>
                </div>
              )}

              {caregiverPhone && (
                <div className="flex items-center gap-3 text-heading-subdued">
                  <Phone className="w-5 h-5 text-brand/60" />
                  <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Phone</span>
                  <span className="text-heading-primary">{caregiverPhone}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Phase Progress */}
      <Card className="lg:col-span-2 border border-[rgba(96,255,168,0.18)]">
        <CardHeader className="flex items-center justify-between border-b border-white/5">
          <CardTitle className="text-heading-primary text-xl tracking-tight">
            Current Phase: {phaseLabels[client.current_phase]}
          </CardTitle>
          <Badge className="bg-[rgba(96,255,168,0.14)] text-heading-primary border-brand/35 px-3 py-1 rounded-xl">
            {phaseLabels[client.current_phase]}
          </Badge>
        </CardHeader>
        <CardContent className="">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-heading-subdued font-semibold mb-4 uppercase tracking-[0.3em] text-xs">Prerequisites</h4>
              {client.current_phase === 'service_initiation' && (
                <div className="space-y-2 bg-client-check border border-[rgba(147,165,197,0.18)] rounded-2xl px-4 py-3">
                  <label className="text-sm text-heading-subdued">Date Of Training / Start Of Care Date?</label>
                  <Input
                    type="date"
                    value={client.training_or_care_start_date || ''}
                    onChange={async (e) => { if (!readOnly) { await onUpdate({ training_or_care_start_date: e.target.value }); } }}
                    disabled={readOnly}
                    className="rounded-lg"
                  />
                </div>
              )}
              {currentPhaseCheckboxes.map((checkbox) => (
                <div
                  key={checkbox.field}
                  className="flex items-center gap-3 bg-client-check border border-[rgba(147,165,197,0.18)] rounded-2xl px-4 py-3 hover:border-brand/30 transition-all"
                >
                  <Checkbox
                    id={checkbox.field}
                    checked={client[checkbox.field] || false}
                    onCheckedChange={(checked) => handleCheckboxChange(checkbox.field, checked)}
                    disabled={readOnly}
                    className="data-[state=checked]:bg-brand data-[state=checked]:border-brand rounded-lg shadow-[0_0_0_3px_rgba(96,255,168,0.12)]"
                  />
                  <label
                    htmlFor={checkbox.field}
                    className={`text-sm transition-colors cursor-pointer ${
                      client[checkbox.field] 
                        ? 'text-heading-primary font-semibold' 
                        : 'text-heading-subdued'
                    }`}
                  >
                    {checkbox.label}
                  </label>
                </div>
              ))}
              <div className="pt-2 flex justify-end">
                <Button
                  variant="default"
                  disabled={(() => {
                    const cbs = phaseCheckboxes[client.current_phase] || [];
                    const allChecked = cbs.every(cb => Boolean(client[cb.field]));
                    if (client.current_phase === 'service_initiation' && !client.training_or_care_start_date) return true;
                    return readOnly || !allChecked || Boolean(client[`${client.current_phase}_finalized`]);
                  })()}
                  onClick={async () => {
                    if (readOnly) return;
                    const key = `${client.current_phase}_finalized`;
                    const confirmed = await confirm({ title: 'Finalize this phase?', description: 'This will lock its checklist.' });
                    if (!confirmed) return;
                    await onUpdate({ [key]: true });
                    push({ title: `${phaseLabels[client.current_phase]} finalized` });
                    const order = ['intake', 'onboarding', 'service_initiation'];
                    const idx = order.indexOf(client.current_phase);
                    if (idx !== -1 && idx < order.length - 1) {
                      const next = order[idx + 1];
                      await onUpdate({ current_phase: next });
                      push({ title: `Moved to ${phaseLabels[next]}` });
                    }
                  }}
                >
                  {client[`${client.current_phase}_finalized`] ? 'Finalized' : 'Submit'}
                </Button>
              </div>
            </div>
            {client.notes && (
              <div className="space-y-4">
                <h4 className="text-heading-subdued font-semibold mb-4 uppercase tracking-[0.3em] text-xs">Notes</h4>
                <div className="bg-client-check border border-[rgba(147,165,197,0.18)] rounded-2xl p-4">
                  <p className="text-heading-subdued text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Full Journey Progress */}
    <div className="mt-8">
      <PhaseProgress client={client} onUpdate={onUpdate} />
    </div>
    </>
  );
}
