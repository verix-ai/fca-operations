// Shared normalization helpers used by all lead-ingestion edge functions
// (submit-lead, facebook-lead-webhook, …). Keeping these in one place means
// a phone-format fix in one channel fixes every channel.

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function normalizeEmail(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toLowerCase()
  return v && isValidEmail(v) ? v : null
}

export function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (digits.length < 10) return null
  return digits.slice(-10)
}

export function normalizeZip(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (digits.length < 5) return null
  return digits.slice(0, 5)
}

export function normalizeMedicaid(raw: unknown): string | null {
  const v = String(raw ?? "").trim()
  return v.length > 0 ? v : null
}

export function normalizeFullName(raw: unknown): string {
  return String(raw ?? "").trim()
}
