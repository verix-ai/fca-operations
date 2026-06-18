import React from 'react'
import { Phone } from 'lucide-react'
import { isCalledThisWeek } from '@/lib/prospects-labels'
import { formatDateInTimezone } from '@/utils'

/**
 * At-a-glance "called this week" indicator for a prospect row.
 *   - Green pill when the client was called on or after this week's Monday.
 *   - Muted pill showing the last call date, or "Not called" when never called.
 */
export default function CalledBadge({ lastCalledAt }) {
  if (isCalledThisWeek(lastCalledAt)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-xs whitespace-nowrap">
        <Phone className="h-3 w-3" /> Called {formatDateInTimezone(lastCalledAt)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 text-heading-subdued px-2 py-0.5 text-xs whitespace-nowrap">
      <Phone className="h-3 w-3" /> {lastCalledAt ? `Last ${formatDateInTimezone(lastCalledAt)}` : 'Not called'}
    </span>
  )
}
