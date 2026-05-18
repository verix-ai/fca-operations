import { supabase } from '@/lib/supabase'
import { alertSeverity } from '../index'

// Expiration dates are entered manually by staff (no more "issued + N years"
// math). Each def points directly at a *_expires_at column.
const CAREGIVER_DOC_DEFS = [
  { docId: 'tb_skin_blood_test',    docName: 'TB Skin/Blood Test',    sourceField: 'tb_test_expires_at' },
  { docId: 'cpr_certificate',       docName: 'CPR Certificate',       sourceField: 'cpr_expires_at' },
  { docId: 'first_aid_certificate', docName: 'First Aid Certificate', sourceField: 'cpr_expires_at' },
  { docId: 'drivers_license',       docName: 'Driving License',       sourceField: 'drivers_license_expires_at' },
  { docId: 'caregiver_training',    docName: 'Caregiver Training',    sourceField: 'caregiver_training_expires_at' },
  { docId: 'fingerprint',           docName: 'Fingerprint',           sourceField: 'fingerprint_expires_at' },
]

const CLIENT_DOC_DEFS = [
  { docId: 'tb_skin_blood_test',    docName: 'TB Skin/Blood Test',    sourceField: 'tb_test_expires_at' },
  { docId: 'cpr_certificate',       docName: 'CPR Certificate',       sourceField: 'cpr_expires_at' },
  { docId: 'first_aid_certificate', docName: 'First Aid Certificate', sourceField: 'cpr_expires_at' },
  { docId: 'drivers_license',       docName: 'Driving License',       sourceField: 'drivers_license_expires_at' },
]

function formatLastFirst(fullName) {
  if (!fullName) return ''
  const parts = String(fullName).trim().split(/\s+/)
  if (parts.length < 2) return fullName
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return `${last}, ${first}`
}

async function fetchCaregivers() {
  const { data, error } = await supabase
    .from('client_caregivers')
    .select('id, full_name, tb_test_expires_at, cpr_expires_at, drivers_license_expires_at, caregiver_training_expires_at, fingerprint_expires_at, client_id, organization_id')
  if (error) throw error
  return data || []
}

async function fetchClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, client_name, tb_test_expires_at, cpr_expires_at, drivers_license_expires_at, organization_id')
  if (error) throw error
  return data || []
}

function buildAlertsFor(entity, kind, defs) {
  const alerts = []
  const labelSuffix = kind === 'caregiver' ? '(CG)' : '(C)'
  const displayName = kind === 'caregiver'
    ? `${formatLastFirst(entity.full_name)} ${labelSuffix}`
    : `${formatLastFirst(entity.client_name)} ${labelSuffix}`

  for (const def of defs) {
    const expiryDate = entity[def.sourceField]
    if (!expiryDate) continue

    alerts.push({
      id: `${kind}:${entity.id}:${def.docId}`,
      category: 'document_expiration',
      severity: alertSeverity(expiryDate),
      entity: {
        kind,
        id: entity.id,
        clientId: kind === 'caregiver' ? entity.client_id : entity.id,
        displayName,
      },
      title: def.docName,
      docId: def.docId,
      dueDate: expiryDate,
      meta: { sourceField: def.sourceField, sourceValue: expiryDate },
    })
  }
  return alerts
}

export const documentExpirationProvider = {
  category: 'document_expiration',
  label: 'Document Expiration',
  async fetchAlerts({ horizonDays = null, includeOk = true } = {}) {
    const [caregivers, clients] = await Promise.all([
      fetchCaregivers(),
      fetchClients(),
    ])

    const all = [
      ...caregivers.flatMap((c) => buildAlertsFor(c, 'caregiver', CAREGIVER_DOC_DEFS)),
      ...clients.flatMap((c) => buildAlertsFor(c, 'client', CLIENT_DOC_DEFS)),
    ]

    let filtered = all
    if (horizonDays != null) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + horizonDays)
      filtered = filtered.filter((a) => new Date(a.dueDate) <= cutoff)
    }
    if (!includeOk) {
      filtered = filtered.filter((a) => a.severity !== 'ok')
    }
    return filtered
  },
}
