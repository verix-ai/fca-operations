import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useTheme } from '@/components/theme/ThemeProvider.jsx'

function formatCurrency(value) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)
  } catch {
    return `$${(value || 0).toLocaleString()}`
  }
}

export default function CostShareChart({ clients = [], isLoading }) {
  const { theme } = useTheme()
  const data = useMemo(() => {
    if (!Array.isArray(clients) || clients.length === 0) return []
    const totalsByProgram = new Map()
    for (const c of clients) {
      const program = c.program || 'Unassigned'
      const amount = typeof c.cost_share_amount === 'number' ? c.cost_share_amount : 0
      totalsByProgram.set(program, (totalsByProgram.get(program) || 0) + amount)
    }
    return Array.from(totalsByProgram.entries()).map(([name, value]) => ({ name, value }))
  }, [clients])

  const totalValue = useMemo(() => data.reduce((sum, d) => sum + (d.value || 0), 0), [data])
  // Brand green palette shades
  const COLORS = ['#63FF82', '#00D9FF', '#7DFF68', '#48F06C', '#00B9FF', '#2BD150', '#0090FF']

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <CardTitle className="text-heading-primary">Total Cost Share by Program</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {totalValue === 0 ? (
          <div className="text-sm text-heading-subdued">No cost share data yet.</div>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={{
                    background: theme === 'dark' ? 'rgba(7,9,12,0.95)' : 'rgba(255,255,255,0.95)',
                    borderRadius: '12px',
                    border: theme === 'dark' ? '1px solid rgba(0,217,255,0.25)' : '1px solid rgba(148,163,184,0.35)',
                    color: theme === 'dark' ? '#F5F6FA' : '#0f172a',
                    boxShadow: theme === 'dark' ? '0 20px 40px -25px rgba(0,217,255,0.35)' : '0 20px 40px -25px rgba(15,23,42,0.18)',
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#F5F6FA' : '#0f172a' }}
                  labelStyle={{ color: theme === 'dark' ? '#9ca3af' : '#64748b' }}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  stroke="#080B10"
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

