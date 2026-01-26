import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Calendar, DollarSign, Phone, Heart, Eye } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProfileImageUpload from "@/components/ui/ProfileImageUpload";

// No phase checklist on Operations Board cards; profile view manages steps.

const programColors = {
  PSS: 'bg-[rgba(96,255,168,0.14)] text-button-contrast border-brand/35',
  PCA: 'bg-[rgba(51,241,255,0.16)] text-button-contrast border-[rgba(51,241,255,0.35)]',
  'Companion Care': 'bg-[rgba(96,255,168,0.14)] text-button-contrast border-brand/35',
  'Respite Care': 'bg-[rgba(51,241,255,0.16)] text-button-contrast border-[rgba(51,241,255,0.35)]'
};

export default function ClientCard({ 
  client
}) {

  return (
    <Card className="hover:border-brand/35 transition-all duration-500">
      <CardContent className="p-6 space-y-6">
        {/* Client Header */}
        <div className="flex items-start justify-between gap-4 md:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ProfileImageUpload
              imageUrl={client.profile_image_url}
              entityId={client.id}
              entityType="client"
              readOnly={true}
              size="md"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-heading-primary text-xl tracking-tight leading-tight">
                {client.client_name}
              </h3>
              <p className="text-xs uppercase tracking-[0.3em] text-heading-subdued whitespace-nowrap">
                {client.intake_date ? format(new Date(client.intake_date), 'MMM d, yyyy') : 'No date'}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Badge className={`${programColors[client.program] || 'bg-[rgba(96,255,168,0.14)] text-button-contrast border-brand/30'} flex-shrink-0 whitespace-nowrap rounded-xl px-3 py-1 font-medium`}>
              {client.program}
            </Badge>
            <Link to={createPageUrl('ClientDetail', { id: client.id })}>
              <Button
                variant="ghost"
                size="icon"
                borderRadius="1rem"
                className="flex-shrink-0 rounded-2xl text-heading-subdued hover:text-heading-primary"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Client Details */}
        <div className="space-y-3 text-sm">
          {client.location && (
            <div className="flex items-center gap-3 text-heading-subdued">
              <MapPin className="w-4 h-4 text-brand/60" />
              <span>{client.location}</span>
            </div>
          )}
          {client.caregiver_name && (
            <div className="flex items-center gap-3 text-heading-subdued">
              <Heart className="w-4 h-4 text-brand/60" />
              <span>{client.caregiver_name} ({client.caregiver_relationship})</span>
            </div>
          )}
          {client.frequency && (
            <div className="flex items-center gap-3 text-heading-subdued">
              <Calendar className="w-4 h-4 text-brand/60" />
              <span>{client.frequency}</span>
            </div>
          )}
          {client.cost_share_amount && (
            <div className="flex items-center gap-3 text-heading-subdued">
              <DollarSign className="w-4 h-4 text-brand/60" />
              <span>${client.cost_share_amount}</span>
            </div>
          )}
          {client.phone_numbers && client.phone_numbers.length > 0 && (
            <div className="flex items-center gap-3 text-heading-subdued">
              <Phone className="w-4 h-4 text-brand/60" />
              <span>{client.phone_numbers[0]}</span>
            </div>
          )}
        </div>

        {/* Checklist and next-phase controls are managed on the client profile. */}
      </CardContent>
    </Card>
  );
}
