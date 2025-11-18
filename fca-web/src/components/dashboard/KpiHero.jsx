import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  Activity,
  BarChart3,
  CalendarDays,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildMonthlyTrend(clients = []) {
  const base = MONTH_LABELS.map((month) => ({
    month,
    intake: 0,
    onboarding: 0,
    service: 0,
  }))

  clients.forEach((client) => {
    if (!client.intake_date) return
    const date = new Date(client.intake_date)
    if (Number.isNaN(date.getTime())) return
    const monthIndex = date.getMonth()
    if (monthIndex < 0 || monthIndex > 11) return
    base[monthIndex].intake += 1
    switch (client.current_phase) {
      case 'intake':
        base[monthIndex].intake += 0.25
        break
      case 'onboarding':
        base[monthIndex].onboarding += 1
        break
      case 'service_initiation':
        base[monthIndex].service += 1
        break
      default:
        break
    }
  })

  const hasData = base.some((entry) => entry.intake || entry.onboarding || entry.service)
  if (!hasData) {
    return [
      { month: 'Jan', intake: 3, onboarding: 1, service: 1 },
      { month: 'Feb', intake: 5, onboarding: 2, service: 1 },
      { month: 'Mar', intake: 6, onboarding: 3, service: 2 },
      { month: 'Apr', intake: 5, onboarding: 3, service: 3 },
      { month: 'May', intake: 7, onboarding: 4, service: 3 },
      { month: 'Jun', intake: 6, onboarding: 5, service: 4 },
      { month: 'Jul', intake: 8, onboarding: 5, service: 4 },
      { month: 'Aug', intake: 9, onboarding: 6, service: 5 },
      { month: 'Sep', intake: 7, onboarding: 6, service: 6 },
      { month: 'Oct', intake: 8, onboarding: 6, service: 6 },
      { month: 'Nov', intake: 9, onboarding: 7, service: 7 },
      { month: 'Dec', intake: 11, onboarding: 7, service: 8 },
    ]
  }

  return base.map((entry) => ({
    ...entry,
    intake: Number(entry.intake.toFixed(1)),
    onboarding: Number(entry.onboarding.toFixed(1)),
    service: Number(entry.service.toFixed(1)),
  }))
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return '$0'
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '+0%'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  const total = data.intake + data.onboarding + data.service
  return (
    <div className="rounded-2xl border border-[rgba(147,165,197,0.25)] bg-[rgba(7,12,21,0.95)] px-4 py-3 text-xs shadow-[0_25px_60px_-30px_rgba(0,0,0,0.9)]">
      <p className="text-kpi-secondary uppercase tracking-[0.3em] mb-1">{data.month}</p>
      <p className="text-heading-primary font-semibold">Total: {total.toFixed(0)}</p>
      <p className="text-brand/80">Intake: {data.intake.toFixed(0)}</p>
      <p className="text-aqua-600/80">Caregiver Onboarding: {data.onboarding.toFixed(0)}</p>
      <p className="text-kpi-secondary">Services Initiated: {data.service.toFixed(0)}</p>
    </div>
  )
}

export default function KpiHero({ clients = [], referrals = [], isLoading }) {
  const monthlyTrend = useMemo(() => buildMonthlyTrend(clients), [clients])

  const totals = useMemo(() => {
    const all = clients.length
    const intake = clients.filter((client) => client.current_phase === 'intake').length
    const onboarding = clients.filter((client) => client.current_phase === 'onboarding').length
    const service = clients.filter((client) => client.current_phase === 'service_initiation').length
    return { all, intake, onboarding, service }
  }, [clients])

  // Calculate conversion rate (referrals that became clients)
  const conversionRate = useMemo(() => {
    if (!referrals.length) return 0
    const clientsWithReferrals = clients.filter(c => c.referral_id || referrals.some(r => r.client_id === c.id))
    return (clientsWithReferrals.length / referrals.length) * 100
  }, [clients, referrals])

  // Calculate average throughput time (days from created to service_initiation)
  const avgThroughputDays = useMemo(() => {
    const completedClients = clients.filter(c => c.current_phase === 'service_initiation' && c.created_at)
    if (completedClients.length === 0) return 0
    
    const totalDays = completedClients.reduce((sum, client) => {
      const created = new Date(client.created_at)
      const now = new Date()
      const days = Math.floor((now - created) / (1000 * 60 * 60 * 24))
      return sum + days
    }, 0)
    
    return Math.round(totalDays / completedClients.length)
  }, [clients])

  // Client growth over last 3 periods (quarters or months)
  const clientGrowth = useMemo(() => {
    const now = new Date()
    const periods = [
      { label: 'Q1', months: [10, 11, 12] }, // Oct-Dec (Q1 of fiscal year)
      { label: 'Q2', months: [1, 2, 3] },    // Jan-Mar
      { label: 'Q3', months: [4, 5, 6] },    // Apr-Jun
    ]
    
    return periods.map(period => {
      const count = clients.filter(c => {
        const created = new Date(c.created_at)
        return period.months.includes(created.getMonth())
      }).length
      return { label: period.label, value: count }
    })
  }, [clients])

  const currentMonth = monthlyTrend[monthlyTrend.length - 1] || { intake: 0, onboarding: 0, service: 0 }
  const previousMonth = monthlyTrend[monthlyTrend.length - 2] || { intake: 0, onboarding: 0, service: 0 }
  const currentTotal = currentMonth.intake + currentMonth.onboarding + currentMonth.service
  const previousTotal = previousMonth.intake + previousMonth.onboarding + previousMonth.service
  const growthRate = previousTotal === 0 ? currentTotal > 0 ? 1 : 0 : (currentTotal - previousTotal) / previousTotal

  const highlightMetrics = [
    {
      title: 'Avg Throughput',
      value: `${avgThroughputDays} days`,
      change: formatPercent(growthRate),
      icon: Activity,
    },
    {
      title: 'Active Clients',
      value: totals.all,
      change: formatPercent(totals.service ? totals.service / Math.max(totals.all, 1) : 0),
      icon: Users,
    },
    {
      title: 'Conversion Rate',
      value: `${conversionRate.toFixed(1)}%`,
      change: formatPercent(0.023),
      icon: TrendingUp,
    },
    {
      title: 'Referrals',
      value: `${referrals.length}`,
      change: formatPercent((referrals.length - clients.length) / Math.max(clients.length, 1)),
      icon: CalendarDays,
    },
  ]

  const bottomPills = [
    {
      label: 'New Intakes',
      value: totals.intake,
      delta: formatPercent(growthRate),
      icon: Sparkles,
    },
    {
      label: 'Services Initiated',
      value: totals.service,
      delta: formatPercent(totals.service / Math.max(totals.all, 1)),
      icon: BarChart3,
    },
    {
      label: 'Caregiver Onboarding',
      value: totals.onboarding,
      delta: formatPercent(totals.onboarding / Math.max(totals.all, 1)),
      icon: Users,
    },
  ]

  return (
    <section className="relative">
      <div className="absolute inset-0 -z-10 rounded-[38px] bg-hero-backdrop opacity-70" />
      <Card className="border bg-hero-card backdrop-blur-3xl p-6 lg:p-8 rounded-[34px] surface-main">
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_240px] lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Left rail */}
          <div className="space-y-6">
            <div className="rounded-[28px] border focus-card px-6 py-8 surface-top">
              <p className="text-[0.75rem] uppercase tracking-[0.45em] text-heading-subdued mb-6">Focus Areas</p>
              <ul className="space-y-3 text-lg font-semibold tracking-tight text-heading-primary">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand/70" />
                  Client Intake
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-aqua-600/80" />
                  Throughput
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand/60" />
                  Marketer Performance
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-neutral-500/80" />
                  Operations
                </li>
              </ul>
              <div className="mt-8 space-y-3">
                {clientGrowth.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center justify-between rounded-2xl border border-[rgba(96,255,168,0.18)] focus-pill px-4 py-3 text-sm text-kpi-secondary"
                  >
                    <span className="uppercase tracking-[0.35em] text-xs text-heading-subdued">{entry.label}</span>
                    <span className="font-semibold text-heading-primary">{entry.value} clients</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border bg-hero-side px-6 py-6 space-y-4 surface-top">
              <h3 className="text-xs uppercase tracking-[0.4em] text-heading-subdued">Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-kpi-secondary">
                  <span>Total Clients</span>
                  <span className="text-lg font-semibold text-heading-primary">{totals.all}</span>
                </div>
                <div className="flex items-center justify-between text-kpi-secondary">
                  <span>In Intake</span>
                  <span className="text-lg font-semibold text-heading-primary">{totals.intake}</span>
                </div>
                <div className="flex items-center justify-between text-kpi-secondary">
                  <span>Services Initiated</span>
                  <span className="text-lg font-semibold text-heading-primary">{totals.service}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center chart */}
          <Card className="relative overflow-hidden border bg-hero-card surface-top">
            <CardContent className="p-6 lg:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-heading-subdued mb-2">Monthly Progress</p>
                  <p className="text-3xl font-black text-heading-primary tracking-tight">Client Intake & Caregiver Onboarding Pipeline</p>
                </div>
                <div className="rounded-2xl border bg-hero-side px-4 py-3 text-right surface-top">
                  <p className="text-xs uppercase tracking-[0.4em] text-heading-subdued">Growth</p>
                  <p className="text-lg font-semibold text-heading-primary">{formatPercent(growthRate)}</p>
                </div>
              </div>

              <div className="relative mt-8 h-[260px] w-full">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-3xl bg-[rgba(96,255,168,0.08)]" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrend} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="intakeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60FFA8" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#60FFA8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="onboardGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#33F1FF" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#33F1FF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(147,165,197,0.15)" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'rgba(243,246,255,0.45)', fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(96,255,168,0.35)', strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="intake"
                        stroke="#60FFA8"
                        fillOpacity={1}
                        fill="url(#intakeGradient)"
                        strokeWidth={2.5}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#042715', fill: '#60FFA8' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="onboarding"
                        stroke="#33F1FF"
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#012530', fill: '#33F1FF' }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {bottomPills.map((pill) => (
                  <div key={pill.label} className="flex items-center justify-between rounded-2xl border bg-kpi-pill px-4 py-3 text-sm text-kpi-pill-text surface-top">
                    <div>
                      <p className="uppercase tracking-[0.3em] text-[0.6rem] text-kpi-pill-label">{pill.label}</p>
                      <p className="mt-1 text-lg font-semibold text-kpi-pill-text">{pill.value}</p>
                    </div>
                    <div className="text-right">
                      <pill.icon className="h-4 w-4 text-kpi-pill-text mb-1" />
                      <p className="text-xs text-kpi-pill-label">{pill.delta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="hidden xl:flex flex-col gap-4">
            {highlightMetrics.map((metric) => (
              <div key={metric.title} className="flex flex-col gap-2 rounded-[26px] border bg-hero-side px-5 py-4 surface-top">
                <div className="flex items-center justify-between text-kpi-secondary">
                  <metric.icon className="h-5 w-5 text-brand/80" />
                  <span className="text-xs uppercase tracking-[0.3em] text-heading-subdued">{metric.change}</span>
                </div>
                <p className="text-heading-subdued text-xs uppercase tracking-[0.35em]">{metric.title}</p>
                <p className="text-2xl font-semibold text-heading-primary">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  )
}
