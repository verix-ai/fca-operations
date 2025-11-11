import React, { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, TrendingUp, TrendingDown, Clock, AlertTriangle, HelpCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'

export default function ProspectMetrics({ referrals = [], clients = [], isLoading }) {
  const [showInfo, setShowInfo] = useState(false)
  
  // Filter to get only prospects (referrals without client_id)
  const prospects = useMemo(() => {
    return referrals.filter(r => !r.client_id)
  }, [referrals])

  // Calculate prospect age (days waiting)
  const prospectAging = useMemo(() => {
    if (!prospects.length) return { avg: 0, oldest: 0 }
    
    const now = new Date()
    const ages = prospects.map(p => {
      const created = new Date(p.created_at)
      return Math.floor((now - created) / (1000 * 60 * 60 * 24))
    })
    
    return {
      avg: Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length),
      oldest: Math.max(...ages)
    }
  }, [prospects])

  // Calculate 30-day growth for prospects
  const prospectGrowth = useMemo(() => {
    if (!prospects.length) return 0
    
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    
    const recentProspects = prospects.filter(p => {
      const created = new Date(p.created_at)
      return created >= thirtyDaysAgo
    }).length
    
    const previousProspects = prospects.filter(p => {
      const created = new Date(p.created_at)
      return created >= sixtyDaysAgo && created < thirtyDaysAgo
    }).length
    
    if (previousProspects === 0) {
      return recentProspects > 0 ? 100 : 0
    }
    
    return ((recentProspects - previousProspects) / previousProspects) * 100
  }, [prospects])

  // Count stale prospects (>14 days old)
  const staleProspects = useMemo(() => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    return prospects.filter(p => {
      const created = new Date(p.created_at)
      return created < fourteenDaysAgo
    }).length
  }, [prospects])

  // Calculate conversion stats
  const conversionStats = useMemo(() => {
    const totalReferrals = referrals.length
    const converted = referrals.filter(r => r.client_id).length
    const rate = totalReferrals > 0 ? (converted / totalReferrals) * 100 : 0
    
    return {
      total: totalReferrals,
      converted,
      unconverted: prospects.length,
      rate: rate.toFixed(1)
    }
  }, [referrals, prospects])

  const formatDelta = (growth) => {
    if (growth === null || isNaN(growth)) return null
    const sign = growth >= 0 ? '+' : ''
    return `${sign}${growth.toFixed(1)}%`
  }

  const isPositiveGrowth = prospectGrowth >= 0

  const statCards = [
    {
      title: 'Active Prospects',
      value: prospects.length,
      icon: Users,
      accent: 'from-purple-500 via-purple-600 to-pink-600',
      delta: formatDelta(prospectGrowth),
      growth: prospectGrowth,
      link: createPageUrl('Prospects'),
    },
    {
      title: 'Conversion Rate',
      value: `${conversionStats.rate}%`,
      icon: TrendingUp,
      accent: 'from-green-500 via-emerald-600 to-teal-600',
      delta: `${conversionStats.converted}/${conversionStats.total}`,
      growth: conversionStats.rate,
      link: createPageUrl('Prospects'),
    },
    {
      title: 'Avg Wait Time',
      value: `${prospectAging.avg}d`,
      icon: Clock,
      accent: 'from-orange-500 via-amber-600 to-yellow-600',
      delta: `Oldest: ${prospectAging.oldest}d`,
      growth: prospectAging.avg <= 7 ? 1 : -1, // Green if avg wait < 7 days
      link: createPageUrl('Prospects'),
    },
    {
      title: 'Stale Prospects',
      value: staleProspects,
      icon: AlertTriangle,
      accent: 'from-red-500 via-rose-600 to-pink-600',
      delta: staleProspects > 0 ? 'Needs attention' : 'All fresh',
      growth: staleProspects === 0 ? 1 : -1,
      link: createPageUrl('Prospects'),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-heading-primary">Prospect Pipeline</h3>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-heading-subdued hover:text-brand transition-colors"
            title="What am I looking at?"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <Link 
          to={createPageUrl('Prospects')}
          className="text-sm text-brand hover:text-brand/80 transition-colors"
        >
          View All →
        </Link>
      </div>
      
      {/* Info Panel */}
      {showInfo && (
        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-sm space-y-2">
          <p className="font-semibold text-heading-primary">What This Shows:</p>
          <p className="text-heading-secondary">
            These cards track your <strong>prospect pipeline</strong> - people who have been referred 
            but haven't started intake yet.
          </p>
          <div className="grid md:grid-cols-2 gap-3 pt-2">
            <div>
              <p className="text-heading-secondary">
                <strong className="text-purple-400">Active Prospects:</strong> Total waiting in pipeline
              </p>
              <p className="text-heading-secondary">
                <strong className="text-green-400">Conversion Rate:</strong> % becoming clients
              </p>
            </div>
            <div>
              <p className="text-heading-secondary">
                <strong className="text-orange-400">Avg Wait Time:</strong> Days since referred
              </p>
              <p className="text-heading-secondary">
                <strong className="text-red-400">Stale Prospects:</strong> Over 14 days old
              </p>
            </div>
          </div>
          <p className="text-heading-subdued pt-2 text-xs">
            💡 <strong>Action:</strong> Follow up with stale prospects daily to improve conversion
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {statCards.map((stat, index) => {
          const isPositive = stat.growth >= 0
          
          return (
            <Link key={index} to={stat.link} className="block focus:outline-none group">
              <div className="relative overflow-hidden rounded-[26px] border border-[rgba(147,165,197,0.18)] bg-kpi-card px-6 py-6 transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_45px_80px_-45px_rgba(147,112,219,0.65)]">
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-full translate-y-[-60%] bg-gradient-to-br ${stat.accent} opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40`} />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.4em] text-white/65">{stat.title}</p>
                    <div className="text-4xl font-black text-white drop-shadow-[0_0_25px_rgba(147,112,219,0.35)]">
                      {isLoading ? <Skeleton className="h-9 w-16 bg-[rgba(147,112,219,0.12)]" /> : stat.value}
                    </div>
                    {stat.delta ? (
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] whitespace-nowrap">
                        {index < 2 && ( // Only show trend icons for first two cards
                          isPositive ? (
                            <TrendingUp className="h-3 w-3 text-green-400" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-400" />
                          )
                        )}
                        <span className={
                          index < 2 
                            ? (isPositive ? "text-green-400/90" : "text-red-400/90")
                            : "text-white/65"
                        }>
                          {stat.delta}
                        </span>
                        {index === 0 && <span className="text-white/40 text-[0.6rem] tracking-[0.2em]">30d</span>}
                      </div>
                    ) : (
                      <p className="text-xs text-white/40 uppercase tracking-[0.3em] whitespace-nowrap">No data</p>
                    )}
                  </div>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-[rgba(147,112,219,0.22)] bg-[rgba(9,16,33,0.85)] text-purple-400 shadow-[0_20px_45px_-20px_rgba(147,112,219,0.7)]">
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

