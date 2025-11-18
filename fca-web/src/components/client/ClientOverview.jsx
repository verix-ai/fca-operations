import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Calendar, DollarSign, Phone, Mail, Heart, Clock } from "lucide-react";
import PhaseProgress from "./PhaseProgress";
import { format } from "date-fns";

const programColors = {
  PSS: 'bg-[rgba(96,255,168,0.14)] text-heading-primary border-brand/35',
  PCA: 'bg-[rgba(51,241,255,0.16)] text-heading-primary border-[rgba(51,241,255,0.35)]',
  'Companion Care': 'bg-[rgba(96,255,168,0.14)] text-heading-primary border-brand/35',
  'Respite Care': 'bg-[rgba(51,241,255,0.16)] text-heading-primary border-[rgba(51,241,255,0.35)]'
};

export default function ClientOverview({ client, onUpdate, readOnly = false }) {

  const clientPhone = client.client_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[0] : null)
  const caregiverPhone = client.caregiver_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[1] : null)

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

    </div>

    {/* Full Journey Progress */}
    <div className="mt-8">
      <PhaseProgress client={client} onUpdate={onUpdate} readOnly={readOnly} />
    </div>
    </>
  );
}
