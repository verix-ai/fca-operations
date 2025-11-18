import React from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function StatsOverview({ clients, isLoading }) {
  const getStats = () => {
    if (isLoading) return { total: 0, intake: 0, onboarding: 0, service: 0 };
    
    return {
      total: clients.length,
      intake: clients.filter(c => c.current_phase === 'intake').length,
      onboarding: clients.filter(c => c.current_phase === 'onboarding').length,
      service: clients.filter(c => c.current_phase === 'service_initiation').length,
    };
  };

  const stats = getStats();

  const statCards = [
    {
      title: "Total Clients",
      value: stats.total,
      icon: Users,
      accent: "from-brand via-brand to-aqua-600",
      phase: null,
      delta: "+12%",
    },
    {
      title: "In Intake",
      value: stats.intake,
      icon: Clock,
      accent: "from-brand/80 via-brand to-brand/60",
      phase: 'intake',
      delta: "+4.8%",
    },
    {
      title: "CG Onboarding",
      value: stats.onboarding,
      icon: AlertCircle,
      accent: "from-aqua-600/80 via-brand/70 to-brand/40",
      phase: 'onboarding',
      delta: "+3.2%",
    },
    {
      title: "Services Initiated",
      value: stats.service,
      icon: CheckCircle,
      accent: "from-brand via-brand/70 to-aqua-600/70",
      phase: 'service_initiation',
      delta: "+6.8%",
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {statCards.map((stat, index) => {
        const href = createPageUrl('ClientList') + (stat.phase ? `?phase=${stat.phase}` : '');
        return (
          <Link key={index} to={href} className="block focus:outline-none group">
            <div className="relative overflow-hidden rounded-[26px] border border-[rgba(96,255,168,0.18)] bg-kpi-card px-6 py-6 transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_45px_80px_-45px_rgba(51,241,255,0.65)]">
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-full translate-y-[-60%] bg-gradient-to-br ${stat.accent} opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40`} />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.4em] text-white/65">{stat.title}</p>
                  <p className="text-4xl font-black text-white drop-shadow-[0_0_25px_rgba(96,255,168,0.35)]">
                    {isLoading ? <Skeleton className="h-9 w-16 bg-[rgba(96,255,168,0.12)]" /> : stat.value}
                  </p>
                  <p className="text-xs text-white/65 uppercase tracking-[0.3em] whitespace-nowrap">{stat.delta}</p>
                </div>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-[rgba(96,255,168,0.22)] bg-[rgba(9,16,33,0.85)] text-brand shadow-[0_20px_45px_-20px_rgba(96,255,168,0.7)]">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  );
}
