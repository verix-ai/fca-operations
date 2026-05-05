import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider.jsx'

const Ctx = createContext({
  unseenCount: 0,
  markSeen: () => {},
  onNewLead: () => () => {},
  requestNotifPermission: async () => false,
})

export const useLeadsRealtime = () => useContext(Ctx)

const STORAGE_KEY = 'fca_leads_last_seen_at'

function readLastSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) || new Date(0).toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}
function writeLastSeen(iso) {
  try { localStorage.setItem(STORAGE_KEY, iso) } catch { /* noop */ }
}

// Soft two-tone "ding" via Web Audio API. No asset file needed.
// Browsers gate audio on a user gesture; we lazily resume the AudioContext
// on the first click anywhere in the app and re-use it from then on.
let _audioCtx = null
function getAudioContext() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    if (!_audioCtx) _audioCtx = new Ctor()
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {})
    return _audioCtx
  } catch { return null }
}
function playChime() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const start = ctx.currentTime
    // Three-tone rising "alert" pattern, each ~140ms, peak gain 0.32.
    // Uses a sine + soft triangle blend so it's bright without being shrill.
    const notes = [
      { freq: 880,  t: 0.00 },  // A5
      { freq: 1175, t: 0.18 },  // D6
      { freq: 1568, t: 0.36 },  // G6 — slightly longer tail
    ]
    notes.forEach(({ freq, t }, i) => {
      const isLast = i === notes.length - 1
      const startAt = start + t
      const dur = isLast ? 0.32 : 0.14
      ;['sine', 'triangle'].forEach((type, ti) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = type
        osc.frequency.setValueAtTime(freq, startAt)
        const peak = ti === 0 ? 0.32 : 0.10  // sine carries the body, triangle adds bite
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
        osc.start(startAt)
        osc.stop(startAt + dur + 0.02)
      })
    })
  } catch { /* noop */ }
}

function showDesktopNotification(lead) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const locale = lead.county
      ? `${lead.county}, GA · ${lead.zip || ''}`.trim()
      : (lead.state === 'OUT_OF_STATE' ? `Out of state · ${lead.zip || ''}`.trim() : '')
    const n = new Notification(`New lead: ${lead.full_name}`, {
      body: locale,
      tag: `lead-${lead.id}`,
      icon: '/fca-logo.png',
    })
    n.onclick = () => {
      window.focus()
      window.location.href = '/leads'
      n.close()
    }
  } catch { /* noop */ }
}

export default function LeadsRealtimeProvider({ children }) {
  const { user } = useAuth() || {}
  const orgId = user?.organization_id
  const [unseenCount, setUnseenCount] = useState(0)
  const listenersRef = useRef(new Set())

  // Unlock the audio context on first user gesture so the chime is reliable.
  useEffect(() => {
    function unlock() {
      getAudioContext()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Initial unseen count = active leads in the user's org created after lastSeen.
  useEffect(() => {
    if (!orgId) { setUnseenCount(0); return }
    let cancelled = false
    ;(async () => {
      const since = readLastSeen()
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('archived_at', null)
        .gt('created_at', since)
      if (!cancelled && !error) setUnseenCount(count || 0)
    })()
    return () => { cancelled = true }
  }, [orgId])

  // Realtime subscription on INSERT.
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`leads-realtime-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const lead = payload.new
          if (!lead) return
          setUnseenCount((c) => c + 1)
          playChime()
          showDesktopNotification(lead)
          listenersRef.current.forEach((cb) => {
            try { cb(lead) } catch { /* noop */ }
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId])

  const markSeen = useCallback(() => {
    writeLastSeen(new Date().toISOString())
    setUnseenCount(0)
  }, [])

  const onNewLead = useCallback((cb) => {
    listenersRef.current.add(cb)
    return () => { listenersRef.current.delete(cb) }
  }, [])

  const requestNotifPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    try {
      const result = await Notification.requestPermission()
      return result === 'granted'
    } catch { return false }
  }, [])

  return (
    <Ctx.Provider value={{ unseenCount, markSeen, onNewLead, requestNotifPermission }}>
      {children}
    </Ctx.Provider>
  )
}
