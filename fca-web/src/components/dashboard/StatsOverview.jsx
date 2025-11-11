import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function StatsOverview({ clients, referrals = [], isLoading }) {
  const getStats = () => {
    if (isLoading) return { total: 0, intake: 0, onboarding: 0, service: 0 };
    
    return {
      total: clients.length,
      intake: clients.filter(c => c.current_phase === 'intake').length,
      onboarding: clients.filter(c => c.current_phase === 'onboarding').length,
      service: clients.filter(c => c.current_phase === 'service_initiation').length,
    };
  };

  // Calculate real growth percentages based on last 30 days vs previous 30 days
  const calculateGrowth = (phase = null) => {
    if (isLoading || !clients.length) return null;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const recentClients = clients.filter(c => {
      const created = new Date(c.created_at);
      const matchesPhase = phase ? c.current_phase === phase : true;
      return created >= thirtyDaysAgo && matchesPhase;
    }).length;
    
    const previousClients = clients.filter(c => {
      const created = new Date(c.created_at);
      const matchesPhase = phase ? c.current_phase === phase : true;
      return created >= sixtyDaysAgo && created < thirtyDaysAgo && matchesPhase;
    }).length;
    
    if (previousClients === 0) {
      return recentClients > 0 ? 100 : 0;
    }
    
    return ((recentClients - previousClients) / previousClients) * 100;
  };

  const formatDelta = (growth) => {
    if (growth === null || isNaN(growth)) return null;
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  };

  const stats = getStats();
  
  const growthTotal = calculateGrowth();
  const growthIntake = calculateGrowth('intake');
  const growthOnboarding = calculateGrowth('onboarding');
  const growthService = calculateGrowth('service_initiation');

  const statCards = [
    {
      title: "Total Clients",
      value: stats.total,
      icon: Users,
      accent: "from-brand via-brand to-aqua-600",
      phase: null,
      delta: formatDelta(growthTotal),
      growth: growthTotal,
    },
    {
      title: "In Intake",
      value: stats.intake,
      icon: Clock,
      accent: "from-brand/80 via-brand to-brand/60",
      phase: 'intake',
      delta: formatDelta(growthIntake),
      growth: growthIntake,
    },
    {
      title: "In Onboarding",
      value: stats.onboarding,
      icon: AlertCircle,
      accent: "from-aqua-600/80 via-brand/70 to-brand/40",
      phase: 'onboarding',
      delta: formatDelta(growthOnboarding),
      growth: growthOnboarding,
    },
    {
      title: "In Service",
      value: stats.service,
      icon: CheckCircle,
      accent: "from-brand via-brand/70 to-aqua-600/70",
      phase: 'service_initiation',
      delta: formatDelta(growthService),
      growth: growthService,
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {statCards.map((stat, index) => {
        const href = createPageUrl('ClientList') + (stat.phase ? `?phase=${stat.phase}` : '');
        const isPositive = stat.growth >= 0;
        const isNeutral = stat.delta === null;
        
        return (
          <Link key={index} to={href} className="block focus:outline-none group">
            <div className="relative overflow-hidden rounded-[26px] border border-[rgba(96,255,168,0.18)] bg-kpi-card px-6 py-6 transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_45px_80px_-45px_rgba(51,241,255,0.65)]">
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-full translate-y-[-60%] bg-gradient-to-br ${stat.accent} opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40`} />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.4em] text-white/65">{stat.title}</p>
                  <div className="text-4xl font-black text-white drop-shadow-[0_0_25px_rgba(96,255,168,0.35)]">
                    {isLoading ? <Skeleton className="h-9 w-16 bg-[rgba(96,255,168,0.12)]" /> : stat.value}
                  </div>
                  {stat.delta ? (
                    <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] whitespace-nowrap">
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 text-green-400" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      )}
                      <span className={isPositive ? "text-green-400/90" : "text-red-400/90"}>
                        {stat.delta}
                      </span>
                      <span className="text-white/40 text-[0.6rem] tracking-[0.2em]">30d</span>
                    </div>
                  ) : (
                    <p className="text-xs text-white/40 uppercase tracking-[0.3em] whitespace-nowrap">No data</p>
                  )}
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
