import { documentExpirationProvider } from './providers/documentExpirationProvider'

const ALERT_PROVIDERS = [
  documentExpirationProvider,
]

export const ALERT_CATEGORIES = {
  DOCUMENT_EXPIRATION: 'document_expiration',
}

export function getAlertProviders() {
  return ALERT_PROVIDERS
}

export function getProviderByCategory(category) {
  return ALERT_PROVIDERS.find((p) => p.category === category) || null
}

export async function loadAlerts({ category = null, options = {} } = {}) {
  const providers = category
    ? ALERT_PROVIDERS.filter((p) => p.category === category)
    : ALERT_PROVIDERS

  const results = await Promise.all(
    providers.map((p) => p.fetchAlerts(options).catch((err) => {
      console.error(`Alert provider "${p.category}" failed:`, err)
      return []
    }))
  )

  return results.flat().sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
    return da - db
  })
}

export function alertSeverity(dueDate, { warningDays = 30 } = {}) {
  if (!dueDate) return 'unknown'
  const now = new Date()
  const due = new Date(dueDate)
  if (due < now) return 'expired'
  const ms = due.getTime() - now.getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  if (days <= warningDays) return 'warning'
  return 'ok'
}
