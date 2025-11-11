import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'
import { ArrowRight, HelpCircle } from 'lucide-react'
import { useState } from 'react'

export default function ReferralConversionChart({ referrals = [], clients = [], isLoading }) {
  const { theme } = useTheme()
  const [showInfo, setShowInfo] = useState(false)
  
  // Calculate conversion stages
  const conversionData = useMemo(() => {
    const totalReferrals = referrals.length
    const activeProspects = referrals.filter(r => !r.client_id).length
    const converted = referrals.filter(r => r.client_id).length
    
    return [
      {
        stage: 'Total Referrals',
        description: 'All people referred to you',
        count: totalReferrals,
        color: '#9333EA',
        percentage: 100,
      },
      {
        stage: 'Still Prospects',
        description: 'Waiting - haven\'t started intake',
        count: activeProspects,
        color: '#A855F7',
        percentage: totalReferrals > 0 ? (activeProspects / totalReferrals) * 100 : 0,
      },
      {
        stage: 'Converted to Clients',
        description: 'Started intake process',
        count: converted,
        color: '#60FFA8',
        percentage: totalReferrals > 0 ? (converted / totalReferrals) * 100 : 0,
      }
    ]
  }, [referrals])

  const axisTickColor = theme === 'dark' ? 'rgba(245,246,250,0.65)' : 'rgba(55,65,81,0.7)'
  const axisLabelColor = theme === 'dark' ? 'rgba(245,246,250,0.6)' : 'rgba(71,85,105,0.65)'
  const gridColor = theme === 'dark' ? 'rgba(147,112,219,0.15)' : 'rgba(148,163,184,0.2)'

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null
    const data = payload[0].payload
    return (
      <div className="rounded-2xl border border-[rgba(147,165,197,0.25)] bg-[rgba(7,12,21,0.95)] px-4 py-3 text-xs shadow-[0_25px_60px_-30px_rgba(0,0,0,0.9)]">
        <p className="text-heading-primary font-semibold text-base mb-1">{data.stage}</p>
        <p className="text-kpi-secondary text-xs mb-2">{data.description}</p>
        <p className="text-heading-primary font-semibold text-lg">{data.count} people</p>
        <p className="text-purple-400/80">{data.percentage.toFixed(1)}% of total referrals</p>
      </div>
    )
  }

  const conversionRate = useMemo(() => {
    const total = conversionData[0]?.count || 0
    const converted = conversionData[2]?.count || 0
    return total > 0 ? ((converted / total) * 100).toFixed(1) : 0
  }, [conversionData])

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-heading-primary">Referral Conversion</CardTitle>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="text-heading-subdued hover:text-brand transition-colors"
                title="What am I looking at?"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-heading-subdued mt-1">
              How many referrals become actual clients
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-heading-subdued">Success Rate</p>
            <p className="text-2xl font-bold text-brand">{conversionRate}%</p>
          </div>
        </div>
        
        {/* Info Panel */}
        {showInfo && (
          <div className="mt-4 p-4 rounded-xl bg-brand/5 border border-brand/20 text-sm space-y-2">
            <p className="font-semibold text-heading-primary">What This Shows:</p>
            <p className="text-heading-secondary">
              This tracks your <strong>conversion funnel</strong> - how many people who are referred to you 
              actually become clients and start the intake process.
            </p>
            <div className="space-y-1 pt-2">
              <p className="text-heading-secondary">
                <strong className="text-purple-400">Total Referrals:</strong> Everyone who's been referred to you
              </p>
              <p className="text-heading-secondary">
                <strong className="text-purple-400">Still Prospects:</strong> People waiting in your Prospects page (haven't started yet)
              </p>
              <p className="text-heading-secondary">
                <strong className="text-brand">Converted to Clients:</strong> People who started intake and became actual clients
              </p>
            </div>
            <p className="text-heading-subdued pt-2 text-xs">
              💡 <strong>Goal:</strong> Get conversion rate above 70% by following up with prospects quickly
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {conversionData[0]?.count === 0 ? (
          <div className="text-sm text-heading-subdued py-8 text-center">
            No referral data yet. Start by adding referrals in the Prospects page.
          </div>
        ) : (
          <>
            {/* Visual Funnel Representation */}
            <div className="mb-8 space-y-3">
              {conversionData.map((stage, index) => {
                const width = stage.percentage
                return (
                  <div key={stage.stage} className="relative">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm font-semibold text-heading-primary">{stage.stage}</span>
                            <span className="text-xs text-heading-subdued ml-2">— {stage.description}</span>
                          </div>
                          <span className="text-sm font-bold text-heading-primary">{stage.count}</span>
                        </div>
                        <div className="w-full h-10 bg-white/5 rounded-xl overflow-hidden relative">
                          <div 
                            className="h-full rounded-xl transition-all duration-1000 flex items-center justify-end pr-4"
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
                    {index < conversionData.length - 1 && (
                      <div className="flex justify-center py-2">
                        <ArrowRight className="h-5 w-5 text-heading-subdued rotate-90" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bar Chart */}
            <div className="w-full h-64 pt-4 border-t border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData} margin={{ top: 12, right: 12, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis 
                    dataKey="stage" 
                    tick={{ fill: axisTickColor, fontSize: 11 }} 
                    axisLine={false} 
                    tickLine={false}
                    angle={-20}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fill: axisLabelColor, fontSize: 12 }} 
                    axisLine={false} 
                    tickLine={false}
                    label={{ value: 'People', angle: -90, position: 'insideLeft', fill: axisLabelColor, fontSize: 11 }}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: theme === 'dark' ? 'rgba(147,112,219,0.08)' : 'rgba(147,112,219,0.12)' }}
                  />
                  <Bar dataKey="count" radius={[12, 12, 4, 4]}>
                    {conversionData.map((entry, index) => (
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

