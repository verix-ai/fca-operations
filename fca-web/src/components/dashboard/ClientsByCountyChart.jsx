import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'

export default function ClientsByCountyChart({ clients = [] }) {
  const { theme } = useTheme()
  const data = useMemo(() => {
    if (!Array.isArray(clients) || clients.length === 0) return []
    const counts = new Map()
    for (const c of clients) {
      const location = (c.location || 'Unknown').trim()
      counts.set(location, (counts.get(location) || 0) + 1)
    }
    // Sort desc by count and cap to top 10 for readability
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    return entries.map(([name, value]) => ({ name, value }))
  }, [clients])

  const axisTickColor = theme === 'dark' ? 'rgba(245,246,250,0.65)' : 'rgba(55,65,81,0.7)'
  const axisLabelColor = theme === 'dark' ? 'rgba(245,246,250,0.6)' : 'rgba(71,85,105,0.65)'
  const gridColor = theme === 'dark' ? 'rgba(0,217,255,0.15)' : 'rgba(148,163,184,0.2)'


  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <CardTitle className="text-heading-primary">Clients by Location (Top 10)</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {data.length === 0 ? (
          <div className="text-sm text-heading-subdued">No client county data yet.</div>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="countyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#63FF82" />
                    <stop offset="100%" stopColor="#00B9FF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fill: axisTickColor, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fill: axisLabelColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: theme === 'dark' ? 'rgba(0,217,255,0.08)' : 'rgba(99,255,130,0.12)' }}
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
                <Bar dataKey="value" fill="url(#countyGradient)" radius={[12, 12, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
