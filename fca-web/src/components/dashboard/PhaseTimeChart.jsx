import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'

export default function PhaseTimeChart({ clients = [], isLoading }) {
  const { theme } = useTheme()
  
  // Calculate average time in each phase
  const data = useMemo(() => {
    const phaseData = {
      intake: { total: 0, count: 0 },
      onboarding: { total: 0, count: 0 },
      service_initiation: { total: 0, count: 0 }
    }
    
    clients.forEach(client => {
      if (!client.created_at || !client.current_phase) return
      
      const created = new Date(client.created_at)
      const now = new Date()
      const daysSinceCreation = Math.floor((now - created) / (1000 * 60 * 60 * 24))
      
      // Simple estimation: clients in later phases have passed through earlier ones
      if (client.current_phase === 'intake') {
        phaseData.intake.total += daysSinceCreation
        phaseData.intake.count += 1
      } else if (client.current_phase === 'onboarding') {
        // Assume they spent some time in intake (rough estimate)
        phaseData.onboarding.total += daysSinceCreation
        phaseData.onboarding.count += 1
      } else if (client.current_phase === 'service_initiation') {
        // They've passed through both phases
        phaseData.service_initiation.total += daysSinceCreation
        phaseData.service_initiation.count += 1
      }
    })
    
    return [
      {
        phase: 'Intake',
        avgDays: phaseData.intake.count > 0 ? Math.round(phaseData.intake.total / phaseData.intake.count) : 0,
        count: phaseData.intake.count,
        color: '#63FF82'
      },
      {
        phase: 'Onboarding',
        avgDays: phaseData.onboarding.count > 0 ? Math.round(phaseData.onboarding.total / phaseData.onboarding.count) : 0,
        count: phaseData.onboarding.count,
        color: '#00D9FF'
      },
      {
        phase: 'Service Init',
        avgDays: phaseData.service_initiation.count > 0 ? Math.round(phaseData.service_initiation.total / phaseData.service_initiation.count) : 0,
        count: phaseData.service_initiation.count,
        color: '#7DFF68'
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
        <p className="text-kpi-secondary uppercase tracking-[0.3em] mb-1">{data.phase}</p>
        <p className="text-heading-primary font-semibold">Avg Time: {data.avgDays} days</p>
        <p className="text-brand/80">Clients: {data.count}</p>
      </div>
    )
  }

  const hasData = data.some(d => d.avgDays > 0)

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <CardTitle className="text-heading-primary">Average Time in Each Phase</CardTitle>
        <p className="text-sm text-heading-subdued mt-1">Days clients spend in each stage</p>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {!hasData ? (
          <div className="text-sm text-heading-subdued">No phase timing data yet.</div>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis 
                  dataKey="phase" 
                  tick={{ fill: axisTickColor, fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fill: axisLabelColor, fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false}
                  label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: axisLabelColor, fontSize: 11 }}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ fill: theme === 'dark' ? 'rgba(0,217,255,0.08)' : 'rgba(99,255,130,0.12)' }}
                />
                <Bar dataKey="avgDays" radius={[12, 12, 4, 4]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

