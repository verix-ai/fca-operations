
import React, { useEffect, useState } from "react";
import { Client } from "@/entities/Client.supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import Referral from "@/entities/Referral.supabase";

import IntakeForm from "@/components/intake/IntakeForm";
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
      // Parse client name into first_name and last_name
      const nameParts = (formData.client_name || '').trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      
      // Build client data with all intake form fields + all referral data
      console.log('📋 Intake Form Data:', formData);
      console.log('📋 Referral Prefill Data:', prefill);
      
      const clientData = {
        // Name fields (store both formats for compatibility)
        first_name: firstName,
        last_name: lastName,
        client_name: formData.client_name || null, // Full name for display
        
        // Contact information
        email: formData.email || null,
        phone_numbers: formData.phone_numbers || [],
        client_phone: formData.client_phone || prefill?.phone || null,
        caregiver_phone: formData.caregiver_phone || prefill?.caregiver_phone || null,
        
        // Caregiver information
        caregiver_name: formData.caregiver_name || prefill?.caregiver_name || null,
        caregiver_relationship: formData.caregiver_relationship || prefill?.caregiver_relationship || null,
        caregiver_lives_in_home: prefill?.caregiver_lives_in_home || null,
        
        // Demographics (from referral)
        sex: prefill?.sex || null,
        date_of_birth: prefill?.referral_dob || null,
        medicaid_or_ssn: prefill?.medicaid_or_ssn || null,
        
        // Address (from referral)
        address_line1: prefill?.address_line1 || null,
        address_line2: prefill?.address_line2 || null,
        city: prefill?.city || null,
        state: prefill?.state || 'GA',
        zip: prefill?.zip || null,
        
        // Program and service details
        company: formData.company || 'FCA',
        program: formData.program || null, // ONLY from intake form, NOT from referral
        frequency: formData.frequency || null,
        cost_share_amount: formData.cost_share_amount || 0,
        
        // Location (store both formats for compatibility)
        county: formData.location || prefill?.county || null,
        location: formData.location || prefill?.county || null,
        
        // Medical information (from referral)
        physician: prefill?.physician || null,
        diagnosis: prefill?.diagnosis || null,
        
        // Services and benefits (from referral)
        services_needed: prefill?.services_needed || {},
        receives_benefits: prefill?.receives_benefits || null,
        benefits_pay_date: prefill?.benefits_pay_date || null,
        
        // Referral source information
        heard_about_us: prefill?.heard_about_us || null,
        additional_info: prefill?.additional_info || null,
        referral_date: prefill?.referral_date || null,
        
        // Dates
        intake_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
        
        // Marketing information (CRITICAL for tracking and payments)
        marketer_id: prefill?.marketer_id || null,
        director_of_marketing: formData.director_of_marketing || prefill?.marketer_name || null,
        
        // Additional information
        notes: formData.notes || prefill?.additional_info || null,
        
        // Pre-Onboarding checkboxes (transfer from referral if they were completed)
        viventium_onboarding_completed: prefill?.viventium_onboarding_completed || false,
        caregiver_fingerprinted: prefill?.caregiver_fingerprinted || false,
        background_results_uploaded: prefill?.background_results_uploaded || false,
        drivers_license_submitted: prefill?.drivers_license_submitted || false,
        ssn_or_birth_certificate_submitted: prefill?.ssn_or_birth_certificate_submitted || false,
        tb_test_completed: prefill?.tb_test_completed || false,
        cpr_first_aid_completed: prefill?.cpr_first_aid_completed || false,
        pca_cert_including_2_of_3: prefill?.pca_cert_including_2_of_3 || false,
        
        // Status tracking
        current_phase: 'intake',
        status: 'active'
      };
      
      console.log('📋 Final Client Data to Save:', clientData);
      
      await Client.create(clientData);
      
      // If this intake originated from a referral, remove it from prospects
      if (prefill?.id) {
        try { await Referral.remove(prefill.id) } catch {}
      }
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Error creating client:", error);
      alert("Error creating client: " + error.message);
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
