import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, MapPin, Calendar, DollarSign, Phone, Mail, Heart, Clock, MessageSquare, Send } from "lucide-react";
import PhaseProgress from "./PhaseProgress";
import ContactModal from "./ContactModal";
import ProfileImageUpload from "@/components/ui/ProfileImageUpload";
import { format } from "date-fns";
import { ClientCaregiver } from "@/entities/ClientCaregiver.supabase";

const programColors = {
  PSS: 'bg-[rgba(96,255,168,0.14)] text-heading-primary border-brand/35',
  PCA: 'bg-[rgba(51,241,255,0.16)] text-heading-primary border-[rgba(51,241,255,0.35)]',
  'Companion Care': 'bg-[rgba(96,255,168,0.14)] text-heading-primary border-brand/35',
  'Respite Care': 'bg-[rgba(51,241,255,0.16)] text-heading-primary border-[rgba(51,241,255,0.35)]'
};

export default function ClientOverview({ client, onUpdate, onRefresh, readOnly = false }) {
  const [contactModal, setContactModal] = useState({ open: false, recipient: null, type: 'client', channel: 'email' });

  const clientPhone = client.client_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[0] : null)

  // Get active caregiver from linked caregivers (new) or fall back to legacy client fields
  const activeCaregiver = client.caregivers?.find(c => c.status === 'active');
  const caregiverName = activeCaregiver?.full_name || client.caregiver_name;
  const caregiverRelationship = activeCaregiver?.relationship || client.caregiver_relationship || '-';
  const caregiverEmail = activeCaregiver?.email || client.caregiver_email;
  const caregiverPhone = activeCaregiver?.phone || client.caregiver_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[1] : null);

  // Handler to update the active caregiver's onboarding fields
  const handleCaregiverUpdate = useCallback(async (updatedData) => {
    if (!activeCaregiver?.id) {
      console.warn('No active caregiver to update');
      return;
    }
    await ClientCaregiver.update(activeCaregiver.id, updatedData);
    // Refresh client data to reflect the changes
    onRefresh?.();
  }, [activeCaregiver?.id, onRefresh]);

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
                <ProfileImageUpload
                  imageUrl={client.profile_image_url}
                  entityId={client.id}
                  entityType="client"
                  readOnly={true}
                  size="md"
                />
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

                {client.cost_share_amount != null && client.cost_share_amount !== '' && (
                  <div className="flex items-center gap-3 text-heading-subdued">
                    <DollarSign className="w-5 h-5 text-brand/60" />
                    <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Cost Share</span>
                    <span className="text-heading-primary">${client.cost_share_amount}</span>
                  </div>
                )}

                {client.email && (
                  <div className="flex items-center gap-3 text-heading-subdued">
                    <Mail className="w-5 h-5 text-brand/60" />
                    <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Email</span>
                    <span className="text-heading-primary">{client.email}</span>
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
                    <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Marketer</span>
                    <span className="text-heading-primary">{client.director_of_marketing}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Caregiver Information */}
        <Card className="border border-[rgba(96,255,168,0.18)]">
          <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="text-heading-primary text-xl flex items-center gap-3 tracking-tight">
              <Heart className="w-5 h-5 text-brand/70" />
              Caregiver Information
            </CardTitle>
            <div className="flex gap-2">
              {caregiverEmail && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-brand hover:bg-brand/10"
                  onClick={() => setContactModal({ open: true, recipient: { name: caregiverName, email: caregiverEmail, phone: caregiverPhone }, type: 'caregiver', channel: 'email' })}
                >
                  <Mail className="w-4 h-4" />
                  Email
                </Button>
              )}
              {caregiverPhone && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-brand hover:bg-brand/10"
                  onClick={() => setContactModal({ open: true, recipient: { name: caregiverName, email: caregiverEmail, phone: caregiverPhone }, type: 'caregiver', channel: 'sms' })}
                >
                  <MessageSquare className="w-4 h-4" />
                  Text
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ProfileImageUpload
                  imageUrl={activeCaregiver?.profile_image_url}
                  entityId={activeCaregiver?.id}
                  entityType="caregiver"
                  readOnly={true}
                  size="md"
                />
                <div>
                  <h3 className="text-xl font-bold text-heading-primary tracking-tight">{caregiverName || 'Not assigned'}</h3>
                  <p className="text-heading-subdued uppercase tracking-[0.3em] text-xs">{caregiverRelationship}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {caregiverEmail && (
                  <div className="flex items-center gap-3 text-heading-subdued">
                    <Mail className="w-5 h-5 text-brand/60" />
                    <span className="font-semibold uppercase tracking-[0.2em] text-xs text-heading-subdued">Email</span>
                    <span className="text-heading-primary">{caregiverEmail}</span>
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

      </div>

      {/* Full Journey Progress */}
      <div className="mt-8">
        <PhaseProgress client={client} onUpdate={onUpdate} onCaregiverUpdate={handleCaregiverUpdate} readOnly={readOnly} />
      </div>

      {/* Contact Modal */}
      <ContactModal
        isOpen={contactModal.open}
        onClose={() => setContactModal({ ...contactModal, open: false })}
        recipient={contactModal.recipient}
        recipientType={contactModal.type}
        recipientId={client.id}
        defaultChannel={contactModal.channel}
      />
    </>
  );
}
