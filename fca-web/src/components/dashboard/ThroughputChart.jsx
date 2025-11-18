import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'

export default function ThroughputChart({ clients = [], isLoading }) {
  const { theme } = useTheme()
  
  // Calculate average throughput time for each month
  const data = useMemo(() => {
    if (!clients.length) return []
    
    const monthlyData = {}
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    clients.forEach(client => {
      if (!client.created_at) return
      
      const created = new Date(client.created_at)
      const monthKey = `${monthNames[created.getMonth()]}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          totalDays: 0,
          count: 0,
          toIntake: 0,
          toOnboarding: 0,
          toService: 0,
          countsByPhase: { intake: 0, onboarding: 0, service: 0 }
        }
      }
      
      const now = new Date()
      const daysSinceCreation = Math.floor((now - created) / (1000 * 60 * 60 * 24))
      
      monthlyData[monthKey].totalDays += daysSinceCreation
      monthlyData[monthKey].count += 1
      
      // Track phase-specific metrics
      if (client.current_phase === 'onboarding' || client.current_phase === 'service_initiation') {
        monthlyData[monthKey].toOnboarding += daysSinceCreation
        monthlyData[monthKey].countsByPhase.onboarding += 1
      }
      
      if (client.current_phase === 'service_initiation') {
        monthlyData[monthKey].toService += daysSinceCreation
        monthlyData[monthKey].countsByPhase.service += 1
      }
    })
    
    // Calculate averages
    return Object.values(monthlyData).map(month => ({
      month: month.month,
      avgDays: month.count > 0 ? Math.round(month.totalDays / month.count) : 0,
      toOnboarding: month.countsByPhase.onboarding > 0 ? Math.round(month.toOnboarding / month.countsByPhase.onboarding) : 0,
      toService: month.countsByPhase.service > 0 ? Math.round(month.toService / month.countsByPhase.service) : 0,
    })).slice(-6) // Last 6 months
  }, [clients])

  const axisTickColor = theme === 'dark' ? 'rgba(245,246,250,0.65)' : 'rgba(55,65,81,0.7)'
  const axisLabelColor = theme === 'dark' ? 'rgba(245,246,250,0.6)' : 'rgba(71,85,105,0.65)'
  const gridColor = theme === 'dark' ? 'rgba(0,217,255,0.15)' : 'rgba(148,163,184,0.2)'

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <CardTitle className="text-heading-primary">Average Throughput Time (Days)</CardTitle>
        <p className="text-sm text-heading-subdued mt-1">Time from intake to current phase</p>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {data.length === 0 ? (
          <div className="text-sm text-heading-subdued">No throughput data yet.</div>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
                <defs>
                  <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#63FF82" />
                    <stop offset="100%" stopColor="#00D9FF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis 
                  dataKey="month" 
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
                  cursor={{ stroke: theme === 'dark' ? 'rgba(0,217,255,0.35)' : 'rgba(99,255,130,0.35)', strokeWidth: 1 }}
                  contentStyle={{
                    background: theme === 'dark' ? 'rgba(7,9,12,0.95)' : 'rgba(255,255,255,0.97)',
                    borderRadius: '12px',
                    border: theme === 'dark' ? '1px solid rgba(0,217,255,0.25)' : '1px solid rgba(148,163,184,0.35)',
                    color: theme === 'dark' ? '#F5F6FA' : '#0f172a',
                    boxShadow: theme === 'dark' ? '0 20px 40px -25px rgba(0,217,255,0.35)' : '0 20px 40px -25px rgba(15,23,42,0.16)',
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#F5F6FA' : '#0f172a' }}
                  labelStyle={{ color: theme === 'dark' ? '#9ca3af' : '#64748b' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="avgDays" 
                  name="Overall Avg"
                  stroke="url(#throughputGradient)" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#042715', fill: '#63FF82' }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="toOnboarding" 
                  name="To Caregiver Onboarding"
                  stroke="#00D9FF" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, strokeWidth: 1, stroke: '#012530', fill: '#00D9FF' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="toService" 
                  name="To Services Initiated"
                  stroke="#7DFF68" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, strokeWidth: 1, stroke: '#0a2e12', fill: '#7DFF68' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

