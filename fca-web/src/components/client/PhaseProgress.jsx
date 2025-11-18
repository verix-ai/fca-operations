import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast.jsx";

export const PHASES = [
  {
    key: 'intake',
    label: 'Client Intake',
    items: [
      { field: 'initial_assessment_required', label: 'Initial Assessment?' },
      { field: 'clinical_dates_entered', label: 'Clinical Dates Entered?' },
      { field: 'reassessment_date_entered', label: 'Re-Assessment Date Entered?' },
      { field: 'initial_assessment_completed', label: 'Initial Assessment Completed?' },
      { field: 'client_documents_populated', label: 'Client Documents Populated?' },
    ],
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    key: 'onboarding',
    label: 'Caregiver Onboarding',
    items: [
      { field: 'viventium_onboarding_completed', label: 'Viventium Onboarding Complete?' },
      { field: 'caregiver_fingerprinted', label: 'Caregiver has been Finger Printed?' },
      { field: 'background_results_uploaded', label: 'Background Results Received & Uploaded?' },
      { field: 'drivers_license_submitted', label: 'Drivers License Submitted?' },
      { field: 'ssn_or_birth_certificate_submitted', label: 'Social Security and/or Birth Certificate Submitted?' },
      { field: 'tb_test_completed', label: 'Completed TB Test?' },
      { field: 'cpr_first_aid_completed', label: 'Completed CPR/First Aid?' },
      { field: 'pca_cert_including_2_of_3', label: 'PCA Cert incl 2/3' },
    ],
    gradient: 'from-blue-400 to-green-500',
  },
  {
    key: 'service_initiation',
    label: 'Services Initiated',
    items: [
      { field: 'edwp_created_and_sent', label: 'Start Of EDWP Created & Sent to Case Manager?' },
      { field: 'edwp_transmittal_completed', label: 'EDWP Transmittal?' },
      { field: 'manager_ccd', label: "Was Manager CC'd?" },
      { field: 'schedule_created_and_extended_until_aed', label: 'Was Schedule Created & Extended until AED?' },
    ],
    gradient: 'from-green-500 to-green-600',
  },
];

function computePhaseStatus(client) {
  return PHASES.map((phase) => {
    const total = phase.items.length;
    const completed = phase.items.reduce((acc, item) => acc + (client[item.field] ? 1 : 0), 0);
    const isCurrent = client.current_phase === phase.key;
    const isCompleted = completed === total;
    return { phase, total, completed, isCurrent, isCompleted };
  });
}

export default function PhaseProgress({ client, onUpdate, readOnly = false }) {
  const { push } = useToast();
  const statuses = useMemo(() => computePhaseStatus(client), [client]);
  const nextPhaseKey = useMemo(() => {
    const idx = PHASES.findIndex(p => p.key === client.current_phase);
    return idx >= 0 && idx < PHASES.length - 1 ? PHASES[idx + 1].key : null;
  }, [client.current_phase]);

  const totalTasks = useMemo(
    () => PHASES.reduce((sum, phase) => sum + phase.items.length, 0),
    []
  );

  const completedTasks = useMemo(
    () =>
      PHASES.reduce(
        (sum, phase) =>
          sum +
          phase.items.reduce((acc, item) => acc + (client[item.field] ? 1 : 0), 0),
        0
      ),
    [client]
  );

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const isPhaseReadyToFinalize = (phaseKey) => {
    const phase = PHASES.find(p => p.key === phaseKey);
    if (!phase) return false;
    const allChecked = phase.items.every(it => Boolean(client[it.field]));
    if (phaseKey === 'service_initiation') {
      return Boolean(client.training_or_care_start_date) && allChecked;
    }
    return allChecked;
  };

  return (
    <Card className="lg:col-span-2 border border-[rgba(96,255,168,0.18)]">
      <CardHeader className="p-6 border-b border-white/5">
        <CardTitle className="text-heading-primary text-xl flex items-center justify-between tracking-tight">
          <span>Care Journey</span>
          <div className="flex flex-col items-end gap-2 min-w-[200px]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-heading-subdued">
              Overall Progress
              <span className="text-heading-primary tracking-normal font-semibold">{completionRate}%</span>
            </div>
            <div className="w-48 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="text-[0.65rem] uppercase tracking-[0.3em] text-heading-subdued">
              {completedTasks}/{totalTasks} Tasks Complete
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid md:grid-cols-3 gap-6">
          {statuses.map(({ phase, total, completed, isCurrent, isCompleted }) => {
            const phaseFinalized = client[`${phase.key}_finalized`];
            const canEdit = !readOnly;
            return (
            <div key={phase.key} className="rounded-2xl border border-[rgba(147,165,197,0.2)] bg-client-check p-5 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className={`px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-[0.2em] border ${isCompleted ? 'bg-[rgba(96,255,168,0.12)] text-heading-primary border-brand/35' : isCurrent ? 'bg-brand/20 text-heading-primary border-brand/30' : 'bg-light-chip text-heading-subdued border-[rgba(147,165,197,0.25)]'}`}>{phase.label}</div>
                <Badge className="bg-light-chip text-heading-subdued border-[rgba(147,165,197,0.3)] px-2 py-0.5 rounded-lg">
                  {completed}/{total}
                </Badge>
              </div>

              <div className="space-y-3">
                {phase.key === 'service_initiation' && (
                  <div className="space-y-2 rounded-xl border border-[rgba(147,165,197,0.25)] bg-black/10 p-3">
                    <label className="text-sm text-heading-subdued">Date Of Training / Start Of Care Date?</label>
                    <Input
                      type="date"
                      value={client.training_or_care_start_date || ''}
                      onChange={async (e) => {
                        if (readOnly) return;
                        await onUpdate({ training_or_care_start_date: e.target.value });
                      }}
                      disabled={readOnly}
                      className="rounded-lg"
                    />
                  </div>
                )}
                {phase.items.map(item => {
                  const checked = Boolean(client[item.field]);
                  return (
                    <div key={item.field} className="flex items-center gap-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={async (val) => {
                          if (!canEdit) return;
                          await onUpdate({ [item.field]: val });
                          const allNowComplete = phase.items.every(it => (it.field === item.field ? val : client[it.field]));
                          if (allNowComplete) {
                            push({ title: 'All items complete. Click Submit to finalize this phase.' });
                          }
                        }}
                        disabled={!canEdit}
                        className={`rounded-lg ${checked ? 'data-[state=checked]:bg-brand data-[state=checked]:border-brand shadow-[0_0_0_3px_rgba(96,255,168,0.12)]' : ''}`}
                      />
                      <span className={`text-sm ${checked ? 'text-heading-primary font-semibold' : 'text-heading-subdued'} ${!canEdit ? 'opacity-70' : ''}`}>{item.label}</span>
                    </div>
                  );
                })}
                <div className="pt-2 flex justify-end">
                  <Button
                    variant="default"
                    disabled={readOnly || phaseFinalized || !isPhaseReadyToFinalize(phase.key)}
                    onClick={async () => {
                      const confirmed = await confirm({ title: 'Finalize this phase?', description: 'This will lock its checklist.' });
                      if (!confirmed) return;
                      await onUpdate({ [`${phase.key}_finalized`]: true });
                      push({ title: `${phase.label} finalized` });
                      if (phase.key === client.current_phase && nextPhaseKey) {
                        await onUpdate({ current_phase: nextPhaseKey });
                        push({ title: `Moved to ${PHASES.find(p => p.key === nextPhaseKey)?.label || 'next phase'}` });
                      }
                    }}
                  >
                    {client[`${phase.key}_finalized`] ? 'Finalized' : 'Submit'}
                  </Button>
                </div>
              </div>
            </div>
          )})}
        </div>
      </CardContent>
    </Card>
  );
}
