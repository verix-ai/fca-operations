import React, { useEffect, useMemo, useState } from 'react'
import { Client } from '@/entities/Client.supabase'
import { Referral } from '@/entities/Referral.supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CostShareChart from '@/components/dashboard/CostShareChart.jsx'
import ClientsByCountyChart from '@/components/dashboard/ClientsByCountyChart.jsx'
import TopMarketersChart from '@/components/dashboard/TopMarketersChart.jsx'
import ThroughputChart from '@/components/dashboard/ThroughputChart.jsx'
import ClientIntakeTrendChart from '@/components/dashboard/ClientIntakeTrendChart.jsx'
import MarketerPerformanceTable from '@/components/dashboard/MarketerPerformanceTable.jsx'
import PhaseTimeChart from '@/components/dashboard/PhaseTimeChart.jsx'
import KpiHero from '@/components/dashboard/KpiHero.jsx'
import StatsOverview from '@/components/dashboard/StatsOverview.jsx'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useAuth } from '@/auth/AuthProvider.jsx'

export default function Reports() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [referrals, setReferrals] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setIsLoading(true)
      try {
        const [clientData, referralData] = await Promise.all([
          Client.list('-created_at'),
          Referral.list()
        ])
        setClients(clientData)
        setReferrals(referralData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  const visibleClients = useMemo(() => {
    if (user?.role === 'marketer') {
      const nameKeyCandidates = ['director_of_marketing', 'marketer_name']
      return clients.filter(c => nameKeyCandidates.some(k => (c?.[k] || '').trim() === (user.name || '').trim()))
    }
    return clients
  }, [clients, user])

  const visibleReferrals = useMemo(() => {
    if (user?.role === 'marketer') {
      return referrals.filter(r => (r?.marketer_name || '').trim() === (user.name || '').trim())
    }
    return referrals
  }, [referrals, user])

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Reports"
        title="Home Care Analytics Dashboard"
        description="Track client onboarding, referral performance, throughput times, and marketer performance metrics — comprehensive insights for operational excellence."
      />

      <KpiHero clients={visibleClients} referrals={visibleReferrals} isLoading={isLoading} />

      <StatsOverview clients={visibleClients} referrals={visibleReferrals} isLoading={isLoading} />

      {/* Primary Charts - Intake Trends and Throughput */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ClientIntakeTrendChart clients={visibleClients} isLoading={isLoading} />
        <ThroughputChart clients={visibleClients} isLoading={isLoading} />
      </div>

      {/* Secondary Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopMarketersChart clients={visibleClients} />
        <PhaseTimeChart clients={visibleClients} isLoading={isLoading} />
      </div>

      {/* Tertiary Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ClientsByCountyChart clients={visibleClients} />
        <CostShareChart clients={visibleClients} isLoading={isLoading} />
      </div>

      {/* Detailed Marketer Performance Table */}
      {user?.role !== 'marketer' && (
        <MarketerPerformanceTable clients={visibleClients} isLoading={isLoading} />
      )}
    </div>
  )
}
