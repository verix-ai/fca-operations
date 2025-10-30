import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

import ClientCard from './ClientCard';

export default function PhaseColumn({ 
  title, 
  phase, 
  clients, 
  isLoading, 
  onUpdatePhase, 
  onUpdateCheckbox,
  color 
}) {
  const canMoveToNextPhase = (client) => {
    switch (phase) {
      case 'intake':
        return client.initial_assessment_required &&
               client.clinical_dates_entered &&
               client.reassessment_date_entered &&
               client.initial_assessment_completed &&
               client.client_documents_populated;
      case 'onboarding':
        return client.viventium_onboarding_completed &&
               client.caregiver_fingerprinted &&
               client.background_results_uploaded &&
               client.drivers_license_submitted &&
               client.ssn_or_birth_certificate_submitted &&
               client.tb_test_completed &&
               client.cpr_first_aid_completed &&
               client.pca_cert_including_2_of_3;
      case 'service_initiation':
        return Boolean(client.training_or_care_start_date) &&
               client.edwp_created_and_sent &&
               client.edwp_transmittal_completed &&
               client.manager_ccd &&
               client.schedule_created_and_extended_until_aed;
      default:
        return false;
    }
  };

  const getNextPhase = (currentPhase) => {
    switch (currentPhase) {
      case 'intake':
        return 'onboarding';
      case 'onboarding':
        return 'service_initiation';
      default:
        return null;
    }
  };

  return (
    <Card className="relative h-fit border border-[rgba(96,255,168,0.16)] bg-gradient-phase">
      <div className="absolute inset-x-0 top-0 h-1/2 bg-phase-glow" />
      <CardHeader className="relative pb-4 border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center justify-between">
          <CardTitle className="text-neutral-50 font-bold text-lg tracking-tight">{title}</CardTitle>
          <div className="flex items-center gap-2 text-brand/80 text-xs uppercase tracking-[0.3em]">
            {clients.length} clients
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative p-6">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl bg-[rgba(96,255,168,0.08)]" />
              ))
            ) : clients.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                <p className="text-sm tracking-wide uppercase">No clients in this phase</p>
              </div>
            ) : (
              clients.map((client) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ClientCard
                    client={client}
                    phase={phase}
                    onUpdateCheckbox={onUpdateCheckbox}
                    canMoveToNext={canMoveToNextPhase(client)}
                    onMoveToNext={() => {
                      const nextPhase = getNextPhase(phase);
                      if (nextPhase) {
                        onUpdatePhase(client.id, nextPhase);
                      }
                    }}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
