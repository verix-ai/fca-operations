import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'
import { ArrowRight, HelpCircle } from 'lucide-react'

export default function ClientPipelineChart({ clients = [], isLoading }) {
  const { theme } = useTheme()
  const [showInfo, setShowInfo] = useState(false)
  
  // Calculate client pipeline stages
  const pipelineData = useMemo(() => {
    const totalClients = clients.length
    const inIntake = clients.filter(c => c.current_phase === 'intake').length
    const inOnboarding = clients.filter(c => c.current_phase === 'onboarding').length
    const inService = clients.filter(c => c.current_phase === 'service_initiation').length
    
    return [
      {
        stage: 'Total Clients',
        description: 'All clients who started intake',
        count: totalClients,
        color: '#60FFA8',
        percentage: 100,
      },
      {
        stage: 'In Intake',
        description: 'Doing paperwork and assessments',
        count: inIntake,
        color: '#63FF82',
        percentage: totalClients > 0 ? (inIntake / totalClients) * 100 : 0,
      },
      {
        stage: 'In Onboarding',
        description: 'Hiring and training caregivers',
        count: inOnboarding,
        color: '#00D9FF',
        percentage: totalClients > 0 ? (inOnboarding / totalClients) * 100 : 0,
      },
      {
        stage: 'In Service',
        description: 'Actively receiving care',
        count: inService,
        color: '#00B9FF',
        percentage: totalClients > 0 ? (inService / totalClients) * 100 : 0,
      }
    ]
  }, [clients])

  const axisTickColor = theme === 'dark' ? 'rgba(245,246,250,0.65)' : 'rgba(55,65,81,0.7)'
  const axisLabelColor = theme === 'dark' ? 'rgba(245,246,250,0.6)' : 'rgba(71,85,105,0.65)'
  const gridColor = theme === 'dark' ? 'rgba(0,217,255,0.15)' : 'rgba(148,163,184,0.2)'

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null
    const data = payload[0].payload
    return (
      <div className="rounded-2xl border border-[rgba(147,165,197,0.25)] bg-[rgba(7,12,21,0.95)] px-4 py-3 text-xs shadow-[0_25px_60px_-30px_rgba(0,0,0,0.9)]">
        <p className="text-heading-primary font-semibold text-base mb-1">{data.stage}</p>
        <p className="text-kpi-secondary text-xs mb-2">{data.description}</p>
        <p className="text-heading-primary font-semibold text-lg">{data.count} clients</p>
        <p className="text-brand/80">{data.percentage.toFixed(1)}% of all clients</p>
      </div>
    )
  }

  const completionRate = useMemo(() => {
    const total = pipelineData[0]?.count || 0
    const inService = pipelineData[3]?.count || 0
    return total > 0 ? ((inService / total) * 100).toFixed(1) : 0
  }, [pipelineData])

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-heading-primary">Client Pipeline</CardTitle>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="text-heading-subdued hover:text-brand transition-colors"
                title="What am I looking at?"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-heading-subdued mt-1">
              Where your clients are in the onboarding process
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-heading-subdued">In Service</p>
            <p className="text-2xl font-bold text-brand">{completionRate}%</p>
          </div>
        </div>
        
        {/* Info Panel */}
        {showInfo && (
          <div className="mt-4 p-4 rounded-xl bg-brand/5 border border-brand/20 text-sm space-y-2">
            <p className="font-semibold text-heading-primary">What This Shows:</p>
            <p className="text-heading-secondary">
              This shows your <strong>client pipeline</strong> - where each client is in the process 
              from starting intake to actively receiving care services.
            </p>
            <div className="space-y-1 pt-2">
              <p className="text-heading-secondary">
                <strong className="text-brand">Total Clients:</strong> Everyone who started the intake process
              </p>
              <p className="text-heading-secondary">
                <strong className="text-brand">In Intake:</strong> Completing paperwork, assessments, and initial setup
              </p>
              <p className="text-heading-secondary">
                <strong className="text-cyan-400">In Onboarding:</strong> Hiring caregivers, background checks, training
              </p>
              <p className="text-heading-secondary">
                <strong className="text-cyan-400">In Service:</strong> Actively receiving homecare services
              </p>
            </div>
            <p className="text-heading-subdued pt-2 text-xs">
              💡 <strong>Goal:</strong> Move clients through pipeline quickly - aim for 70%+ in Service
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {pipelineData[0]?.count === 0 ? (
          <div className="text-sm text-heading-subdued py-8 text-center">
            No client data yet. Clients appear here once they start intake.
          </div>
        ) : (
          <>
            {/* Visual Pipeline Representation */}
            <div className="mb-8 space-y-3">
              {pipelineData.map((stage, index) => {
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
                    {index < pipelineData.length - 1 && (
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
                <BarChart data={pipelineData} margin={{ top: 12, right: 12, bottom: 40, left: 0 }}>
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
                    label={{ value: 'Clients', angle: -90, position: 'insideLeft', fill: axisLabelColor, fontSize: 11 }}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: theme === 'dark' ? 'rgba(0,217,255,0.08)' : 'rgba(99,255,130,0.12)' }}
                  />
                  <Bar dataKey="count" radius={[12, 12, 4, 4]}>
                    {pipelineData.map((entry, index) => (
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

