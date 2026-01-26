import React, { useState, useEffect, useCallback } from "react";
import { Client } from "@/entities/Client.supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Save, MessageSquare, FileText, User, Heart, Trash2, AlertTriangle, Loader2, ClipboardCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { useAuth } from "@/auth/AuthProvider.jsx";
import { Input } from "@/components/ui/input";

import ClientEditForm from "@/components/client/ClientEditForm";
import ClientNotes from "@/components/client/ClientNotes";
import ClientMessages from "@/components/client/ClientMessages";
import ClientOverview from "@/components/client/ClientOverview";
import CaregiverProfile from "@/components/client/CaregiverProfile";
import ClientCompliance from "@/components/client/ClientCompliance";
import SectionHeader from "@/components/layout/SectionHeader.jsx";
import ProfileImageUpload from "@/components/ui/ProfileImageUpload";

export default function ClientDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadClient = useCallback(async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (id) {
        const clientData = await Client.get(id);
        setClient(clientData);
      }
      if (tab) {
        setActiveTab(tab);
      }
    } catch (error) {
      console.error("Error loading client:", error);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const handleClientUpdate = async (updatedData) => {
    try {
      await Client.update(client.id, updatedData);
      // Use functional update to avoid race conditions when multiple updates fire sequentially
      setClient(prev => ({ ...prev, ...updatedData }));
    } catch (error) {
      console.error("Error updating client:", error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE' || !client) return
    setIsDeleting(true)
    try {
      await Client.remove(client.id)
      navigate(createPageUrl('ClientList'))
    } catch (e) {
      console.error('Delete failed', e)
    }
    setIsDeleting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="text-heading-subdued uppercase tracking-[0.3em] text-xs">Loading client</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-heading-subdued">Client not found</p>
          <Button
            variant="default"
            borderRadius="999px"
            className="gap-2 px-6"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-stretch gap-6">
          <Button
            variant="outline"
            size="icon"
            borderRadius="1.25rem"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="rounded-2xl"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <SectionHeader
            eyebrow="Client Blueprint"
            title={client.client_name}
            media={(
              <ProfileImageUpload
                imageUrl={client.profile_image_url}
                entityId={client.id}
                entityType="client"
                onUpload={async (url) => {
                  await handleClientUpdate({ profile_image_url: url });
                }}
                readOnly={user?.role === 'marketer'}
                size="lg"
              />
            )}
            actions={user?.role !== 'marketer' ? (
              <Button
                variant="outline"
                borderRadius="999px"
                background="rgba(239,68,68,0.1)"
                textColor="rgb(239,68,68)"
                style={{ borderColor: 'rgba(239,68,68,0.4)' }}
                onClick={() => { setConfirmText(''); setConfirmOpen(true) }}
                className="gap-2 px-5 hover:bg-red-500/15"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            ) : null}
            description={client.intake_date ? `Intake ${format(new Date(client.intake_date), 'MMM d, yyyy')}` : undefined}
          >
            <div className="flex flex-wrap items-center gap-4 text-heading-subdued">
              <span className="flex items-center gap-2 uppercase tracking-[0.3em] text-xs">
                <Heart className="w-4 h-4 text-brand/70" />
                Caregiver: {client.caregivers?.find(c => c.status === 'active')?.full_name || client.caregiver_name || 'Not assigned'}
              </span>
              <span className="uppercase tracking-[0.3em] text-xs">Program: {client.program}</span>
            </div>
          </SectionHeader>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="bg-hero-card p-2 rounded-3xl border border-[rgba(147,165,197,0.25)] backdrop-blur-xl inline-flex w-auto min-w-full md:w-full">
              <TabsTrigger
                value="overview"
                className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
              >
                <FileText className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="caregiver"
                className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
              >
                <Heart className="w-4 h-4 mr-2" />
                Caregiver
              </TabsTrigger>
              {user?.role !== 'marketer' && (
                <TabsTrigger
                  value="edit"
                  className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Edit Details</span>
                  <span className="sm:hidden">Edit</span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="compliance"
                className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Compliance
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
              >
                <FileText className="w-4 h-4 mr-2" />
                Notes
              </TabsTrigger>
              <TabsTrigger
                value="messages"
                className="rounded-2xl px-4 py-2.5 md:px-6 md:py-3 text-sm whitespace-nowrap"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Team Messages</span>
                <span className="sm:hidden">Messages</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <ClientOverview client={client} onUpdate={handleClientUpdate} onRefresh={loadClient} readOnly={user?.role === 'marketer'} />
          </TabsContent>
          <TabsContent value="caregiver">
            <CaregiverProfile
              client={client}
              caregivers={client.caregivers || []}
              onUpdate={handleClientUpdate}
              onRefresh={loadClient}
              readOnly={user?.role === 'marketer'}
            />
          </TabsContent>

          {user?.role !== 'marketer' && (
            <TabsContent value="edit">
              <ClientEditForm client={client} onUpdate={handleClientUpdate} />
            </TabsContent>
          )}

          <TabsContent value="compliance">
            <ClientCompliance 
              client={client} 
              onUpdate={handleClientUpdate} 
              readOnly={user?.role === 'marketer'} 
            />
          </TabsContent>

          <TabsContent value="notes">
            <ClientNotes clientId={client.id} />
          </TabsContent>

          <TabsContent value="messages">
            <ClientMessages clientId={client.id} clientName={client.client_name} />
          </TabsContent>
        </Tabs>

        {confirmOpen && user?.role !== 'marketer' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setConfirmOpen(false)} />
            <div className="relative bg-[#0F1115] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex items-center gap-4 mb-4 text-amber-500">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-heading-primary">Delete Client?</h3>
              </div>

              <div className="space-y-4 mb-6">
                <p className="text-heading-subdued">
                  Are you sure you want to delete <span className="font-medium text-heading-primary">{client?.client_name}</span>? This action cannot be undone.
                </p>

                <div className="space-y-2">
                  <label className="text-xs text-heading-subdued uppercase tracking-wider">
                    Type <span className="text-brand font-bold">DELETE</span> to confirm
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="rounded-xl border-white/10 bg-black/20 focus:border-red-500/50"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={handleDelete}
                  disabled={isDeleting || confirmText !== 'DELETE'}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
