import React, { useEffect, useMemo, useState } from 'react'
import { Client } from '@/entities/Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CostShareChart from '@/components/dashboard/CostShareChart.jsx'
import ClientsByCountyChart from '@/components/dashboard/ClientsByCountyChart.jsx'
import TopMarketersChart from '@/components/dashboard/TopMarketersChart.jsx'
import KpiHero from '@/components/dashboard/KpiHero.jsx'
import StatsOverview from '@/components/dashboard/StatsOverview.jsx'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useAuth } from '@/auth/AuthProvider.jsx'

export default function Reports() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setIsLoading(true)
      try {
        const data = await Client.list('-created_date')
        setClients(data)
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

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Reports"
        title="Home Care Analytics Dashboard"
        description="Track and align client onboarding, referral performance, caregiver assignments, and service delivery metrics — all in one interactive dashboard with visual performance tiles and detailed drill-down reports."
      />

      <KpiHero clients={visibleClients} isLoading={isLoading} />

      <StatsOverview clients={visibleClients} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CostShareChart clients={visibleClients} isLoading={isLoading} />
        <ClientsByCountyChart clients={visibleClients} />
        <TopMarketersChart clients={visibleClients} />
      </div>
    </div>
  )
}
