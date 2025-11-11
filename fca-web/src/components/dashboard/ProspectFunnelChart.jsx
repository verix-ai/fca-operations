import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'
import { Users, ArrowRight, CheckCircle } from 'lucide-react'

export default function ProspectFunnelChart({ referrals = [], clients = [], isLoading }) {
  const { theme } = useTheme()
  
  // Calculate funnel stages
  const funnelData = useMemo(() => {
    const totalReferrals = referrals.length
    const activeProspects = referrals.filter(r => !r.client_id).length
    const converted = referrals.filter(r => r.client_id).length
    const inIntake = clients.filter(c => c.current_phase === 'intake').length
    const inOnboarding = clients.filter(c => c.current_phase === 'onboarding').length
    const inService = clients.filter(c => c.current_phase === 'service_initiation').length
    
    return [
      {
        stage: 'Referrals',
        count: totalReferrals,
        color: '#9333EA',
        percentage: 100,
        icon: '📋'
      },
      {
        stage: 'Active Prospects',
        count: activeProspects,
        color: '#A855F7',
        percentage: totalReferrals > 0 ? (activeProspects / totalReferrals) * 100 : 0,
        icon: '👥'
      },
      {
        stage: 'Converted',
        count: converted,
        color: '#60FFA8',
        percentage: totalReferrals > 0 ? (converted / totalReferrals) * 100 : 0,
        icon: '✅'
      },
      {
        stage: 'In Intake',
        count: inIntake,
        color: '#63FF82',
        percentage: totalReferrals > 0 ? (inIntake / totalReferrals) * 100 : 0,
        icon: '📝'
      },
      {
        stage: 'In Onboarding',
        count: inOnboarding,
        color: '#00D9FF',
        percentage: totalReferrals > 0 ? (inOnboarding / totalReferrals) * 100 : 0,
        icon: '⚙️'
      },
      {
        stage: 'In Service',
        count: inService,
        color: '#00B9FF',
        percentage: totalReferrals > 0 ? (inService / totalReferrals) * 100 : 0,
        icon: '🎯'
      }
    ]
  }, [referrals, clients])

  const axisTickColor = theme === 'dark' ? 'rgba(245,246,250,0.65)' : 'rgba(55,65,81,0.7)'
  const axisLabelColor = theme === 'dark' ? 'rgba(245,246,250,0.6)' : 'rgba(71,85,105,0.65)'
  const gridColor = theme === 'dark' ? 'rgba(147,112,219,0.15)' : 'rgba(148,163,184,0.2)'

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null
    const data = payload[0].payload
    return (
      <div className="rounded-2xl border border-[rgba(147,165,197,0.25)] bg-[rgba(7,12,21,0.95)] px-4 py-3 text-xs shadow-[0_25px_60px_-30px_rgba(0,0,0,0.9)]">
        <p className="text-kpi-secondary uppercase tracking-[0.3em] mb-1">{data.stage}</p>
        <p className="text-heading-primary font-semibold text-lg">{data.count}</p>
        <p className="text-purple-400/80">{data.percentage.toFixed(1)}% of total</p>
      </div>
    )
  }

  const conversionRate = useMemo(() => {
    const total = funnelData[0]?.count || 0
    const converted = funnelData[2]?.count || 0
    return total > 0 ? ((converted / total) * 100).toFixed(1) : 0
  }, [funnelData])

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-heading-primary">Conversion Funnel</CardTitle>
            <p className="text-sm text-heading-subdued mt-1">From referral to service initiation</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-heading-subdued">Conversion</p>
            <p className="text-2xl font-bold text-brand">{conversionRate}%</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {funnelData[0]?.count === 0 ? (
          <div className="text-sm text-heading-subdued">No funnel data yet.</div>
        ) : (
          <>
            {/* Visual Funnel Representation */}
            <div className="mb-8 space-y-3">
              {funnelData.map((stage, index) => {
                const width = stage.percentage
                return (
                  <div key={stage.stage} className="relative">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl">{stage.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-heading-primary">{stage.stage}</span>
                          <span className="text-sm text-heading-secondary">{stage.count}</span>
                        </div>
                        <div className="w-full h-8 bg-white/5 rounded-lg overflow-hidden relative">
                          <div 
                            className="h-full rounded-lg transition-all duration-1000 flex items-center justify-end pr-3"
                            style={{ 
                              width: `${width}%`,
                              background: `linear-gradient(to right, ${stage.color}BB, ${stage.color})`
                            }}
                          >
                            <span className="text-xs font-bold text-white drop-shadow-lg">
                              {width.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < funnelData.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowRight className="h-4 w-4 text-heading-subdued rotate-90" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bar Chart */}
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis 
                    dataKey="stage" 
                    tick={{ fill: axisTickColor, fontSize: 11 }} 
                    axisLine={false} 
                    tickLine={false}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fill: axisLabelColor, fontSize: 12 }} 
                    axisLine={false} 
                    tickLine={false}
                    label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: axisLabelColor, fontSize: 11 }}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: theme === 'dark' ? 'rgba(147,112,219,0.08)' : 'rgba(147,112,219,0.12)' }}
                  />
                  <Bar dataKey="count" radius={[12, 12, 4, 4]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

