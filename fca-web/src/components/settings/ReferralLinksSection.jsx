import React, { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Link2, Copy, Download, Check, Loader2, Search, AlertCircle } from 'lucide-react'
import User from '@/entities/User.supabase'
import { OFFICE_ROLES } from '@/lib/officeRole'
import {
  ALLOWED_PAGE_SIZES,
  clampPage,
  getWindow,
  readPersistedPageSize,
  writePersistedPageSize,
} from '@/lib/pagination'

const PUBLIC_BASE = 'https://friendlycareagency.org/ref/'
const PAGE_SIZE_STORAGE_KEY = 'fca.settings.referralLinks.pageSize'
const DEFAULT_PAGE_SIZE = 10

function urlForSlug(slug) {
  return `${PUBLIC_BASE}${slug}`
}

async function generateQrPngBlob(slug) {
  const dataUrl = await QRCode.toDataURL(urlForSlug(slug), {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 1024,
  })
  const res = await fetch(dataUrl)
  return res.blob()
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function QrThumbnail({ slug }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!slug || !ref.current) return
    QRCode.toCanvas(ref.current, urlForSlug(slug), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 96,
    }).catch(() => { /* ignore */ })
  }, [slug])
  return <canvas ref={ref} className="rounded border border-slate-200 bg-white" aria-label={`QR for ${slug}`} />
}

function UserRow({ user, onCopy, copiedSlug }) {
  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const blob = await generateQrPngBlob(user.referral_slug)
      downloadBlob(blob, `fca-referral-qr-${user.referral_slug}.png`)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell className="capitalize text-sm text-slate-600">{user.role}</TableCell>
      <TableCell>
        <span className="font-mono text-sm">
          <span className="text-slate-400">{PUBLIC_BASE}</span>
          <span className="text-emerald-700 font-semibold">{user.referral_slug}</span>
        </span>
      </TableCell>
      <TableCell><QrThumbnail slug={user.referral_slug} /></TableCell>
      <TableCell>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onCopy(user.referral_slug)}>
            {copiedSlug === user.referral_slug
              ? <><Check className="w-4 h-4 mr-1" /> Copied</>
              : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> …</>
              : <><Download className="w-4 h-4 mr-1" /> QR</>}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function ReferralLinksSection() {
  const [marketers, setMarketers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => readPersistedPageSize(PAGE_SIZE_STORAGE_KEY, DEFAULT_PAGE_SIZE))
  const [copiedSlug, setCopiedSlug] = useState(null)
  const [zipping, setZipping] = useState(false)
  const [zipError, setZipError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const all = await User.list()
        if (cancelled) return
        // Active office users with a slug.
        const office = (all || []).filter(
          u => u.is_active && OFFICE_ROLES.includes(u.role) && u.referral_slug
        )
        // Sort: role asc, then name asc — Admins above Marketers, alphabetical within.
        office.sort((a, b) =>
          a.role.localeCompare(b.role) || (a.name || '').localeCompare(b.name || '')
        )
        setMarketers(office)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load users')
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return marketers
    return marketers.filter(m =>
      m.name?.toLowerCase().includes(q) || m.referral_slug?.toLowerCase().includes(q)
    )
  }, [marketers, search])

  const total = filtered.length
  const safePage = clampPage(page, total, pageSize)
  const { start, end } = getWindow(safePage, pageSize)
  const items = filtered.slice(start, end)

  const handleCopy = async (slug) => {
    try {
      await navigator.clipboard.writeText(urlForSlug(slug))
      setCopiedSlug(slug)
      setTimeout(() => setCopiedSlug(null), 1500)
    } catch { /* clipboard blocked */ }
  }

  const handleZipAll = async () => {
    if (zipping || filtered.length === 0) return
    setZipping(true); setZipError(null)
    try {
      const zip = new JSZip()
      // Generate every QR sequentially to keep memory steady; this is fine for typical team sizes.
      for (const m of filtered) {
        const blob = await generateQrPngBlob(m.referral_slug)
        zip.file(`${m.referral_slug}.png`, blob)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const today = new Date().toISOString().slice(0, 10)
      downloadBlob(zipBlob, `fca-employee-qr-codes-${today}.zip`)
    } catch (err) {
      setZipError(err?.message || 'Failed to build ZIP')
    } finally {
      setZipping(false)
    }
  }

  const showingFrom = total === 0 ? 0 : start + 1
  const showingTo = Math.min(end, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" /> Referral Links
          </CardTitle>
          <Button type="button" onClick={handleZipAll} disabled={zipping || filtered.length === 0}>
            {zipping
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Building ZIP…</>
              : <><Download className="w-4 h-4 mr-1" /> Download all (ZIP)</>}
          </Button>
        </div>
        {zipError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4" /> {zipError}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-slate-500 text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading users…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search by name or slug…"
                  className="pl-9"
                />
              </div>
              <span className="text-sm text-slate-500">
                {total} {total === 1 ? 'user' : 'users'}
              </span>
            </div>

            {total === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center">
                No active office users with a referral slug.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Public link</TableHead>
                      <TableHead className="w-28">QR</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        onCopy={handleCopy}
                        copiedSlug={copiedSlug}
                      />
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-2">
                  <span>Showing {showingFrom}–{showingTo} of {total}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      Per page:
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          setPageSize(next)
                          writePersistedPageSize(PAGE_SIZE_STORAGE_KEY, next)
                          setPage(1)
                        }}
                        className="border border-slate-200 rounded px-2 py-1"
                      >
                        {ALLOWED_PAGE_SIZES.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setPage(safePage - 1)}
                      >
                        Prev
                      </Button>
                      <span className="px-2">{safePage} / {totalPages}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage(safePage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
