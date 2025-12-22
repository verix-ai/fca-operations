import React, { useState, useEffect } from "react";
import { Client } from "@/entities/Client.supabase";

import PhaseColumn from "@/components/dashboard/PhaseColumn";
import StatsOverview from "@/components/dashboard/StatsOverview";
import SectionHeader from "@/components/layout/SectionHeader.jsx";

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await Client.list("-created_at");
      setClients(data);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
    setIsLoading(false);
  };

  const updateClientPhase = async (clientId, newPhase) => {
    const previous = clients.find(c => c.id === clientId)?.current_phase;
    // Optimistic update to avoid full-board reload flash
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, current_phase: newPhase } : c));
    try {
      await Client.update(clientId, { current_phase: newPhase });
    } catch (error) {
      console.error("Error updating client phase:", error);
      // Revert on failure
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, current_phase: previous } : c));
    }
  };

  const updateClientCheckbox = async (clientId, field, value) => {
    const previous = clients.find(c => c.id === clientId)?.[field];
    // Optimistic update to avoid skeleton flash
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, [field]: value } : c));
    try {
      await Client.update(clientId, { [field]: value });
    } catch (error) {
      console.error("Error updating client:", error);
      // Revert on failure
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, [field]: previous } : c));
    }
  };

  const getClientsByPhase = (phase) => {
    return clients.filter(client => client.current_phase === phase);
  };

  return (
    <div className="space-y-10">
      <div className="space-y-10">
        {/* Header */}
        <SectionHeader
          eyebrow="Overview"
          title="Operations Board"
          description="Monitor Referrals, Clients, and Services Initiated."
        />

        {/* Stats Overview */}
        <StatsOverview clients={clients} referrals={[]} isLoading={isLoading} />


        {/* Operation Board */}
        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <PhaseColumn
            title="Caregiver Onboarding"
            phase="onboarding"
            clients={getClientsByPhase("onboarding")}
            isLoading={isLoading}
            onUpdatePhase={updateClientPhase}
            onUpdateCheckbox={updateClientCheckbox}
            color="from-brand/20 to-brand"
          />
          <PhaseColumn
            title="Client Intake"
            phase="intake"
            clients={getClientsByPhase("intake")}
            isLoading={isLoading}
            onUpdatePhase={updateClientPhase}
            onUpdateCheckbox={updateClientCheckbox}
            color="from-brand/30 to-brand"
          />
          <PhaseColumn
            title="Services Initiated"
            phase="service_initiation"
            clients={getClientsByPhase("service_initiation")}
            isLoading={isLoading}
            onUpdatePhase={updateClientPhase}
            onUpdateCheckbox={updateClientCheckbox}
            color="from-brand/30 to-brand"
          />
        </div>
      </div>
    </div>
  );
}
