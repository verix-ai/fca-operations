import React, { useState, useEffect, useCallback } from "react";
import { Client } from "@/entities/Client.supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Save, MessageSquare, FileText, User, Heart, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { useAuth } from "@/auth/AuthProvider.jsx";

import ClientEditForm from "@/components/client/ClientEditForm";
import ClientNotes from "@/components/client/ClientNotes";
import ClientMessages from "@/components/client/ClientMessages";
import ClientOverview from "@/components/client/ClientOverview";
import CaregiverProfile from "@/components/client/CaregiverProfile";
import SectionHeader from "@/components/layout/SectionHeader.jsx";

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
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-client-avatar shadow-[0_24px_45px_-28px_rgba(96,255,168,0.35)]">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand/40 via-transparent to-aqua-600/40 blur-xl" />
                <User className="relative h-10 w-10 text-icon-primary" />
              </div>
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

          <TabsContent value="notes">
            <ClientNotes clientId={client.id} />
          </TabsContent>

          <TabsContent value="messages">
            <ClientMessages clientId={client.id} />
          </TabsContent>
        </Tabs>

        {confirmOpen && user?.role !== 'marketer' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setConfirmOpen(false)} />
            <div className="relative bg-[rgba(7,12,21,0.95)] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-md mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]">
              <div className="p-6 border-b border-white/5">
                <h2 className="text-lg font-semibold text-heading-primary">Delete Client</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-heading-subdued text-sm">
                  This action cannot be undone. To confirm, type <span className="font-semibold">DELETE</span> below.
                </p>
                <p className="text-heading-primary text-sm">
                  Client: <span className="font-semibold">{client?.client_name}</span>
                </p>
                <input
                  className="w-full rounded-2xl bg-[rgba(9,16,33,0.82)] border border-[rgba(147,165,197,0.25)] text-heading-primary placeholder-neutral-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  autoFocus
                  disabled={isDeleting}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="inline-flex items-center justify-center rounded-2xl border border-[rgba(147,165,197,0.25)] px-4 py-2 text-neutral-800 hover:border-brand/35 hover:bg-brand/10 transition-all"
                    onClick={() => setConfirmOpen(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-heading-primary bg-red-500/90 border-red-500 hover:brightness-90 disabled:opacity-50"
                    onClick={handleDelete}
                    disabled={confirmText !== 'DELETE' || isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
