import React from 'react'

/**
 * Shared building blocks for the Prospects filter UI (desktop bar + mobile sheet).
 * Keeping the status-filter list in one place means both layouts stay in sync.
 */

// The six boolean "workflow status" filters, rendered as toggle chips.
const STATUS_FILTERS = [
  { key: 'unsentOnly',           label: 'Unsent' },
  { key: 'waitingStateApproval', label: 'Waiting: state approval' },
  { key: 'waitingCmCall',        label: 'Waiting: CM call' },
  { key: 'needResend',           label: 'No call / resend' },
  { key: 'hadAssessment',        label: 'Had assessment' },
  { key: 'notCalledThisWeek',    label: 'Not called this week' },
]

/** Small uppercase heading that labels a filter group. */
export function GroupLabel({ children }) {
  return <div className="text-xs uppercase tracking-[0.2em] text-heading-subdued mb-2">{children}</div>
}

/** A pill-shaped on/off toggle. Emerald when active, subtle outline when not. */
export function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-colors ${
        active
          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
          : 'border-[rgba(147,165,197,0.25)] text-heading-primary hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

/** The full row of status toggle chips, wrapping as needed. */
export function StatusChips({ filters, set }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_FILTERS.map(f => (
        <Chip key={f.key} active={!!filters[f.key]} onClick={() => set(f.key, !filters[f.key])}>
          {f.label}
        </Chip>
      ))}
    </div>
  )
}
