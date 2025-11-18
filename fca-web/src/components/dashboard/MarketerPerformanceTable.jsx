import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Award, Clock, Users } from 'lucide-react'

export default function MarketerPerformanceTable({ clients = [], isLoading }) {
  
  const marketerStats = useMemo(() => {
    const stats = new Map()
    
    clients.forEach(client => {
      const marketerName = (client.director_of_marketing || client.marketer_name || 'Unassigned').trim()
      
      if (!stats.has(marketerName)) {
        stats.set(marketerName, {
          name: marketerName,
          totalClients: 0,
          inIntake: 0,
          inOnboarding: 0,
          inService: 0,
          avgThroughputDays: 0,
          totalDays: 0,
          serviceCount: 0,
          last30Days: 0
        })
      }
      
      const marketer = stats.get(marketerName)
      marketer.totalClients += 1
      
      // Count by phase
      if (client.current_phase === 'intake') {
        marketer.inIntake += 1
      } else if (client.current_phase === 'onboarding') {
        marketer.inOnboarding += 1
      } else if (client.current_phase === 'service_initiation') {
        marketer.inService += 1
        
        // Calculate throughput for service clients
        if (client.created_at) {
          const created = new Date(client.created_at)
          const now = new Date()
          const days = Math.floor((now - created) / (1000 * 60 * 60 * 24))
          marketer.totalDays += days
          marketer.serviceCount += 1
        }
      }
      
      // Count last 30 days
      if (client.created_at) {
        const created = new Date(client.created_at)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        if (created >= thirtyDaysAgo) {
          marketer.last30Days += 1
        }
      }
    })
    
    // Calculate averages and convert to array
    const result = Array.from(stats.values()).map(m => ({
      ...m,
      avgThroughputDays: m.serviceCount > 0 ? Math.round(m.totalDays / m.serviceCount) : 0,
      completionRate: m.totalClients > 0 ? Math.round((m.inService / m.totalClients) * 100) : 0
    }))
    
    // Sort by total clients descending
    return result.sort((a, b) => b.totalClients - a.totalClients)
  }, [clients])

  const topPerformers = useMemo(() => {
    if (marketerStats.length < 2) return []
    const sorted = [...marketerStats].sort((a, b) => b.last30Days - a.last30Days)
    return sorted.slice(0, 3).map(m => m.name)
  }, [marketerStats])

  if (isLoading) {
    return (
      <Card className="w-full bg-hero-card border surface-main">
        <CardHeader className="p-6 pb-4 border-b border-white/5">
          <CardTitle className="text-heading-primary">Marketer Performance Details</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="text-sm text-heading-subdued">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full bg-hero-card border surface-main">
      <CardHeader className="p-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-heading-primary">Marketer Performance Details</CardTitle>
            <p className="text-sm text-heading-subdued mt-1">Comprehensive performance metrics for each marketer</p>
          </div>
          <Badge variant="outline" className="border-brand/30 text-brand bg-brand/10">
            <Award className="w-3 h-3 mr-1" />
            {marketerStats.length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {marketerStats.length === 0 ? (
          <div className="text-sm text-heading-subdued">No marketer data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-heading-subdued font-semibold">Marketer</TableHead>
                  <TableHead className="text-heading-subdued font-semibold text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" />
                      Total
                    </div>
                  </TableHead>
                  <TableHead className="text-heading-subdued font-semibold text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Last 30d
                    </div>
                  </TableHead>
                  <TableHead className="text-heading-subdued font-semibold text-center">Intake</TableHead>
                  <TableHead className="text-heading-subdued font-semibold text-center">Caregiver Onboarding</TableHead>
                  <TableHead className="text-heading-subdued font-semibold text-center">Services Initiated</TableHead>
                  <TableHead className="text-heading-subdued font-semibold text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" />
                      Avg Days
                    </div>
                  </TableHead>
                  <TableHead className="text-heading-subdued font-semibold text-center">Complete %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketerStats.map((marketer, index) => {
                  const isTopPerformer = topPerformers.includes(marketer.name)
                  const rank = index + 1
                  
                  return (
                    <TableRow key={marketer.name} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium text-heading-primary">
                        <div className="flex items-center gap-2">
                          {rank <= 3 && (
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-brand/20 to-aqua-600/20 text-xs font-bold text-brand border border-brand/30">
                              {rank}
                            </span>
                          )}
                          <span className={rank <= 3 ? 'font-semibold' : ''}>
                            {marketer.name}
                          </span>
                          {isTopPerformer && (
                            <Award className="w-4 h-4 text-brand/80" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-heading-primary text-lg">{marketer.totalClients}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={marketer.last30Days > 0 
                            ? "border-green-400/30 text-green-400 bg-green-400/10" 
                            : "border-white/10 text-heading-subdued bg-white/5"
                          }
                        >
                          {marketer.last30Days > 0 && <TrendingUp className="w-3 h-3 mr-1" />}
                          {marketer.last30Days}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-heading-secondary">{marketer.inIntake}</TableCell>
                      <TableCell className="text-center text-heading-secondary">{marketer.inOnboarding}</TableCell>
                      <TableCell className="text-center text-heading-secondary">{marketer.inService}</TableCell>
                      <TableCell className="text-center">
                        {marketer.avgThroughputDays > 0 ? (
                          <span className={marketer.avgThroughputDays < 30 ? "text-green-400 font-semibold" : "text-heading-secondary"}>
                            {marketer.avgThroughputDays}d
                          </span>
                        ) : (
                          <span className="text-heading-subdued">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-brand to-aqua-600 rounded-full transition-all duration-500"
                              style={{ width: `${marketer.completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-heading-primary w-10 text-right">
                            {marketer.completionRate}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

