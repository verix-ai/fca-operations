// Simple localStorage-backed User store for demo auth

const STORAGE_KEY = 'fca_users'

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    // In-place migration: rename default marketer to Mark Cuban
    if (Array.isArray(parsed) && parsed.length > 0) {
      let changed = false
      const next = parsed.map(u => {
        if (String(u.email || '').toLowerCase() === 'marketer@fca.local' && u.name !== 'Mark Cuban') {
          changed = true
          return { ...u, name: 'Mark Cuban' }
        }
        return u
      })
      if (changed) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      }
      return next
    }
  } catch {}
  // Seed defaults if empty
  const seeded = [
    { id: 'admin', name: 'Admin User', email: 'admin@fca.local', role: 'admin' },
    { id: 'marketer-one', name: 'Mark Cuban', email: 'marketer@fca.local', role: 'marketer' },
  ]
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)) } catch {}
  return seeded
}

function saveAll(users) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(users)) } catch {}
}

const UserStore = {
  async list() {
    return loadAll()
  },

  async findByEmail(email) {
    const users = loadAll()
    const normalized = String(email || '').trim().toLowerCase()
    return users.find(u => String(u.email || '').toLowerCase() === normalized) || null
  },

  async acceptInvite({ token, name, email }) {
    // token is ignored in local demo; real impl would verify it
    const users = loadAll()
    const existing = await this.findByEmail(email)
    if (existing) return existing
    const id = (name || email || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const user = { id, name: name || email, email, role: 'marketer' }
    users.push(user)
    saveAll(users)
    return user
  },
}

export { UserStore as default, UserStore }


