import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'

export default function ClientIntakeTrendChart({ clients = [], isLoading }) {
  const { theme } = useTheme()

  // Calculate monthly intake counts
  const data = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const currentYear = new Date().getFullYear()

    // Initialize all months
    const monthlyData = monthNames.map(month => ({
      month,
      count: 0,
      intake: 0,
      onboarding: 0,
      service: 0
    }))

    // Count clients by month
    clients.forEach(client => {
      if (!client.created_at) return

      const created = new Date(client.created_at)
      if (created.getFullYear() !== currentYear) return

      const monthIndex = created.getMonth()
      monthlyData[monthIndex].count += 1

      // Track current phase distribution
      if (client.current_phase === 'intake') {
        monthlyData[monthIndex].intake += 1
      } else if (client.current_phase === 'onboarding') {
        monthlyData[monthIndex].onboarding += 1
      } else if (client.current_phase === 'service_initiation') {
        monthlyData[monthIndex].service += 1
      }
    })

    return monthlyData
  }, [clients])

  const axisTickColor = theme === 'dark' ? 'rgba(245,246,250,0.65)' : 'rgba(55,65,81,0.7)'
  const axisLabelColor = theme === 'dark' ? 'rgba(245,246,250,0.6)' : 'rgba(71,85,105,0.65)'
  const gridColor = theme === 'dark' ? 'rgba(0,217,255,0.15)' : 'rgba(148,163,184,0.2)'

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null
    const data = payload[0].payload
    return (
      <div className="rounded-2xl border border-[rgba(147,165,197,0.25)] bg-[rgba(7,12,21,0.95)] px-4 py-3 text-xs shadow-[0_25px_60px_-30px_rgba(0,0,0,0.9)]">
        <p className="text-kpi-secondary uppercase tracking-[0.3em] mb-1">{data.month}</p>
        <p className="text-heading-primary font-semibold">Total: {data.count}</p>
        <p className="text-aqua-600/80">Caregiver Onboarding: {data.onboarding}</p>
        <p className="text-brand/80">In Intake: {data.intake}</p>
        <p className="text-green-400/80">Services Initiated: {data.service}</p>
      </div>
    )
  }

  const totalIntake = useMemo(() => data.reduce((sum, month) => sum + month.count, 0), [data])

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-heading-primary">New Client Intake Trend</CardTitle>
            <p className="text-sm text-heading-subdued mt-1">Monthly new clients added this year</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-heading-subdued">YTD Total</p>
            <p className="text-2xl font-bold text-brand">{totalIntake}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {totalIntake === 0 ? (
          <div className="text-sm text-heading-subdued">No intake data for this year yet.</div>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
                <defs>
                  <linearGradient id="intakeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60FFA8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#60FFA8" stopOpacity={0.1} />
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
                  label={{ value: 'Clients', angle: -90, position: 'insideLeft', fill: axisLabelColor, fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(96,255,168,0.35)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#60FFA8"
                  fillOpacity={1}
                  fill="url(#intakeAreaGradient)"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#042715', fill: '#60FFA8' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

