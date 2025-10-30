
import React, { useEffect, useState } from "react";
import { Client } from "@/entities/Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import Referral from "@/entities/Referral";

import IntakeForm from "../components/intake/IntakeForm";
import SectionHeader from "@/components/layout/SectionHeader.jsx";

export default function ClientIntake() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefill, setPrefill] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    if (!refId) return;
    (async () => {
      try {
        const r = await Referral.get(refId);
        if (r) setPrefill(r);
      } catch {}
    })();
  }, []);

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      // Carry over all referral fields (except identifiers) so the full referral context is preserved on the client
      const referralCarryOver = prefill ? (() => {
        const { id: referral_id, created_at: referral_created_at, marketer_id: _mid, marketer_name: _mname, marketer_email: _memail, ...rest } = prefill || {};
        return { referral_id, referral_created_at, ...rest };
      })() : {};

      const preOnboarding = prefill ? {
        viventium_onboarding_completed: Boolean(prefill.viventium_onboarding_completed),
        caregiver_fingerprinted: Boolean(prefill.caregiver_fingerprinted),
        background_results_uploaded: Boolean(prefill.background_results_uploaded),
        drivers_license_submitted: Boolean(prefill.drivers_license_submitted),
        ssn_or_birth_certificate_submitted: Boolean(prefill.ssn_or_birth_certificate_submitted),
        tb_test_completed: Boolean(prefill.tb_test_completed),
        cpr_first_aid_completed: Boolean(prefill.cpr_first_aid_completed),
        pca_cert_including_2_of_3: Boolean(prefill.pca_cert_including_2_of_3),
      } : {};
      await Client.create({
        // referral fields first; intake fields override where names overlap
        ...referralCarryOver,
        ...formData,
        ...preOnboarding,
        marketer_id: prefill?.marketer_id || undefined,
        marketer_name: prefill?.marketer_name || undefined,
        marketer_email: prefill?.marketer_email || undefined,
        current_phase: 'intake',
        intake_date: new Date().toISOString().split('T')[0]
      });
      // If this intake originated from a referral, remove it from prospects
      if (prefill?.id) {
        try { await Referral.remove(prefill.id) } catch {}
      }
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Error creating client:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-10">
      <div className="space-y-10">
        {/* Header */}
        <SectionHeader
          eyebrow="Intake Pipeline"
          title="New Client Intake"
          description="Complete the intake form to initiate the onboarding workflow."
        />

        {/* Intake Form */}
        <Card className="border border-[rgba(96,255,168,0.18)]">
          <CardHeader className="p-8 border-b border-white/5">
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <IntakeForm onSubmit={handleSubmit} isSubmitting={isSubmitting} referral={prefill} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
