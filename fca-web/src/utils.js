export function createPageUrl(name) {
  switch (name) {
    case 'Dashboard':
      return '/dashboard';
    case 'Reports':
      return '/reports';
    case 'ClientList':
      return '/clients';
    case 'MarketerIntake':
      return '/marketer-intake';
    case 'ClientIntake':
      return '/clients/new';
    case 'ClientDetail':
      return '/client';
    case 'Messages':
      return '/messages';
    case 'Prospects':
      return '/prospects';
    case 'Settings':
      return '/settings';
    default:
      return '/';
  }
}

export default { createPageUrl };

// Format a US phone string as (XXX) XXX-XXXX as the user types
export function formatPhone(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10)
  const part1 = digits.slice(0,3)
  const part2 = digits.slice(3,6)
  const part3 = digits.slice(6,10)
  if (digits.length > 6) return `(${part1}) ${part2}-${part3}`
  if (digits.length > 3) return `(${part1}) ${part2}`
  if (digits.length > 0) return `(${part1}`
  return ''
}

// Read configured timezone from localStorage-backed settings synchronously
export function getConfiguredTimezone(defaultTz = 'UTC') {
  try {
    const raw = localStorage.getItem('fca_settings')
    if (!raw) return defaultTz
    const parsed = JSON.parse(raw)
    return parsed?.timezone || defaultTz
  } catch {
    return defaultTz
  }
}

// Format an ISO timestamp string into 'YYYY-MM-DD HH:mm' for a given IANA timezone
// Falls back gracefully if Intl or the timezone is not supported
export function formatDateInTimezone(isoString, fallbackTz = 'UTC') {
  const s = String(isoString || '').trim()
  if (!s) return ''
  const tz = getConfiguredTimezone(fallbackTz)
  try {
    const dt = new Date(s)
    const fmt = new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
    })
    const parts = fmt.formatToParts(dt)
    const get = (t) => parts.find(p => p.type === t)?.value || ''
    const yyyy = get('year')
    const mm = get('month')
    const dd = get('day')
    const hh = get('hour')
    const min = get('minute')
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`
  } catch {
    return (s || '').replace('T',' ').slice(0,16)
  }
}

