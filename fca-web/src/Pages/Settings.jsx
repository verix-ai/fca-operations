import React, { useEffect, useState } from 'react'
import Program from '@/entities/Program'
import CmCompany from '@/entities/CmCompany'
import Marketer from '@/entities/Marketer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Save } from 'lucide-react'
import SectionHeader from '@/components/layout/SectionHeader.jsx'

export default function Settings() {
  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage the foundational data that powers programs, service regions, and marketer preferences."
      />

      <div className="grid gap-8 items-start lg:grid-cols-2">
        <ProgramsSection />
        <CmCompaniesSection />
        <TimezoneSection />
        <CountiesSection />
        <MarketersSection />
      </div>
    </div>
  )
}

function TimezoneSection() {
  const [currentTz, setCurrentTz] = useState('UTC')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const s = await SettingsStore.get()
        setCurrentTz(s?.timezone || 'UTC')
      } catch {}
    })()
  }, [])

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
  ]

  const saveTz = async () => {
    setSaving(true)
    try {
      await SettingsStore.update({ timezone: currentTz })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Timezone</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="w-64">
            <Select value={currentTz} onValueChange={setCurrentTz}>
              <SelectTrigger className="rounded-xl h-9">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button onClick={saveTz} variant="default" borderRadius="1rem" className="px-5" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
function CmCompaniesSection() {
  const [list, setList] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = async () => { setList(await CmCompany.list()) }
  useEffect(() => {
    (async () => {
      let companies = await CmCompany.list()
      if (companies.length === 0) {
        // seed with existing values from legacy constant
        const defaults = ['B & B Care','NSC','Infinity','Compassionate','Legacy-ICWP','HCM-ICWP','AAA','First Choice','Paris Heights','Rapha Health']
        for (const name of defaults) await CmCompany.create({ name })
        companies = await CmCompany.list()
      }
      setList(companies)
    })()
  }, [])

  const addItem = async () => {
    const name = newName.trim()
    if (!name) return
    await CmCompany.create({ name })
    setNewName('')
    load()
  }

  const startEdit = (m) => { setEditingId(m.id); setEditingName(m.name) }
  const saveEdit = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    await CmCompany.update(editingId, { id: name, name })
    setEditingId(null); setEditingName('')
    load()
  }
  const remove = async (id) => { await CmCompany.remove(id); load() }

  return (
    <div className="max-w-xl">
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Case Management Companies</CardTitle>
          <Button onClick={() => setIsAdding(true)} variant="default" borderRadius="999px" className="h-9 gap-2 px-4">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(147,165,197,0.2)]">
                <TableHead className="text-heading-subdued p-4">Name</TableHead>
                <TableHead className="text-heading-subdued p-4 w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(m => (
                <TableRow key={m.id} className="border-b border-[rgba(147,165,197,0.2)]">
                  <TableCell className="p-4">
                    {editingId === m.id ? (
                      <Input value={editingName} onChange={(e)=>setEditingName(e.target.value)} className="rounded-xl" />
                    ) : (
                      <span className="text-heading-primary">{m.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    {editingId === m.id ? (
                      <Button onClick={saveEdit} variant="default" borderRadius="1rem" className="gap-2 px-5">
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={() => startEdit(m)} variant="outline" borderRadius="1rem" className="px-4">Edit</Button>
                        <Button onClick={() => remove(m.id)} variant="outline" borderRadius="1rem" className="px-4"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setIsAdding(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[rgba(9,16,33,0.9)] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Add Case Management Company</h3>
              </div>
              <div className="p-4 space-y-3">
                <Input autoFocus value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="Company name" className="rounded-xl" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" borderRadius="1rem" className="px-4" onClick={() => { setIsAdding(false); setNewName('') }}>Cancel</Button>
                  <Button variant="default" borderRadius="1rem" className="gap-2 px-5" onClick={async () => { await addItem(); setIsAdding(false) }}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProgramsSection() {
  const [programs, setPrograms] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = async () => { setPrograms(await Program.list()) }
  useEffect(() => { load() }, [])

  const addProgram = async () => {
    const name = newName.trim()
    if (!name) return
    await Program.create({ name })
    setNewName('')
    load()
  }

  const startEdit = (p) => { setEditingId(p.id); setEditingName(p.name) }
  const saveEdit = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    await Program.update(editingId, { id: name, name })
    setEditingId(null); setEditingName('')
    load()
  }
  const remove = async (id) => { await Program.remove(id); load() }

  return (
    <div className="max-w-xl">
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Programs</CardTitle>
          <Button
            onClick={() => setIsAdding(true)}
            variant="default"
            borderRadius="999px"
            className="h-9 gap-2 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(147,165,197,0.2)]">
                <TableHead className="text-heading-subdued p-4">Name</TableHead>
                <TableHead className="text-heading-subdued p-4 w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map(p => (
                <TableRow key={p.id} className="border-b border-[rgba(147,165,197,0.2)]">
                  <TableCell className="p-4">
                    {editingId === p.id ? (
                      <Input value={editingName} onChange={(e)=>setEditingName(e.target.value)} className="rounded-xl" />
                    ) : (
                      <span className="text-heading-primary">{p.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    {editingId === p.id ? (
                      <Button
                        onClick={saveEdit}
                        variant="default"
                        borderRadius="1rem"
                        className="gap-2 px-5"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => startEdit(p)}
                          variant="outline"
                          borderRadius="1rem"
                          className="px-4"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => remove(p.id)}
                          variant="outline"
                          borderRadius="1rem"
                          className="px-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setIsAdding(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[rgba(9,16,33,0.9)] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Add Program</h3>
              </div>
              <div className="p-4 space-y-3">
                <Input autoFocus value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="Program name" className="rounded-xl" />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    borderRadius="1rem"
                    className="px-4"
                    onClick={() => {
                      setIsAdding(false)
                      setNewName('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    borderRadius="1rem"
                    className="gap-2 px-5"
                    onClick={async () => {
                      await addProgram()
                      setIsAdding(false)
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MarketersSection() {
  const [list, setList] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = async () => { setList(await Marketer.list()) }
  useEffect(() => { load() }, [])

  const addItem = async () => {
    const name = newName.trim()
    if (!name) return
    await Marketer.create({ name })
    setNewName('')
    load()
  }

  const startEdit = (m) => { setEditingId(m.id); setEditingName(m.name) }
  const saveEdit = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    await Marketer.update(editingId, { id: name, name })
    setEditingId(null); setEditingName('')
    load()
  }
  const remove = async (id) => { await Marketer.remove(id); load() }

  return (
    <div className="max-w-xl">
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Marketers</CardTitle>
          <Button
            onClick={() => setIsAdding(true)}
            variant="default"
            borderRadius="999px"
            className="h-9 gap-2 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(147,165,197,0.2)]">
                <TableHead className="text-heading-subdued p-4">Name</TableHead>
                <TableHead className="text-heading-subdued p-4 w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(m => (
                <TableRow key={m.id} className="border-b border-[rgba(147,165,197,0.2)]">
                  <TableCell className="p-4">
                    {editingId === m.id ? (
                      <Input value={editingName} onChange={(e)=>setEditingName(e.target.value)} className="rounded-xl" />
                    ) : (
                      <span className="text-heading-primary">{m.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    {editingId === m.id ? (
                      <Button
                        onClick={saveEdit}
                        variant="default"
                        borderRadius="1rem"
                        className="gap-2 px-5"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => startEdit(m)}
                          variant="outline"
                          borderRadius="1rem"
                          className="px-4"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => remove(m.id)}
                          variant="outline"
                          borderRadius="1rem"
                          className="px-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setIsAdding(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[rgba(9,16,33,0.9)] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Add Marketer</h3>
              </div>
              <div className="p-4 space-y-3">
                <Input autoFocus value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="Marketer name" className="rounded-xl" />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    borderRadius="1rem"
                    className="px-4"
                    onClick={() => {
                      setIsAdding(false)
                      setNewName('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    borderRadius="1rem"
                    className="gap-2 px-5"
                    onClick={async () => {
                      await addItem()
                      setIsAdding(false)
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const US_STATES = [
  { code: 'GA', name: 'Georgia' },
  { code: 'FL', name: 'Florida' },
  { code: 'AL', name: 'Alabama' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'NC', name: 'North Carolina' },
];

async function fetchCountiesCSV(stateCode) {
  const cacheKey = `fca_counties_${stateCode}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  // Try multiple CSV sources, stop on first success
  const sources = [
    'https://raw.githubusercontent.com/kjhealy/fips-codes/master/state_and_county_fips_master.csv',
    'https://raw.githubusercontent.com/kjhealy/fips-codes/master/county_fips_master.csv',
  ]
  for (const url of sources) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const text = await res.text()
      const lines = text.split(/\r?\n/)
      const header = lines.shift() || ''
      const cols = header.split(',').map(s => s.trim().toLowerCase())
      const stateIdx = cols.findIndex(c => c === 'state' || c === 'stusab' || c === 'stateabbr')
      const nameIdx = cols.findIndex(c => c.includes('county') && c.includes('name'))
      const countyIdx = nameIdx >= 0 ? nameIdx : cols.findIndex(c => c === 'county' || c === 'county_name')
      if (stateIdx === -1 || countyIdx === -1) continue
      const names = []
      for (const line of lines) {
        if (!line) continue
        const parts = line.split(',')
        const st = (parts[stateIdx] || '').replace(/"/g, '').trim()
        const county = (parts[countyIdx] || '').replace(/"/g, '').trim()
        // state column might be full name; map to code if needed
        const match = US_STATES.find(s => s.code === st || s.name.toLowerCase() === st.toLowerCase())
        if (match && match.code === stateCode && county) {
          const cleaned = county.replace(/ County$/i, '')
          names.push(cleaned)
        }
      }
      const unique = Array.from(new Set(names)).sort()
      if (unique.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(unique))
        return unique
      }
    } catch (e) {
      // try next source
    }
  }
  return []
}

import SettingsStore from '@/entities/Settings'
import countiesData from '@/data/counties.json'
async function fetchCounties(stateCode) {
  return countiesData[stateCode] || []
}

function CountiesSection() {
  const [regions, setRegions] = useState({})
  const [isAdding, setIsAdding] = useState(false)
  const [modalState, setModalState] = useState('GA')
  const [modalSelected, setModalSelected] = useState([])
  const [modalOriginal, setModalOriginal] = useState([])
  const [modalCounties, setModalCounties] = useState([])

  useEffect(() => {
    (async () => {
      const all = await SettingsStore.get()
      setRegions(all?.regions || {})
    })()
  }, [])

  const openAdd = async () => {
    const all = await SettingsStore.get()
    const list = all?.regions?.[modalState] || []
    setModalOriginal(list)
    setModalSelected(list)
    setIsAdding(true)
    const full = await fetchCounties(modalState)
    setModalCounties(full)
  }

  const loadModalForState = async (code) => {
    setModalState(code)
    const list = (regions||{})[code] || []
    setModalOriginal(list)
    setModalSelected(list)
    const full = await fetchCounties(code)
    setModalCounties(full)
  }

  const arraysEqual = (a, b) => {
    if (a.length !== b.length) return false
    const sa = [...a].sort(); const sb = [...b].sort();
    return sa.every((v,i)=>v===sb[i])
  }

  const toggleModalCounty = (county) => {
    setModalSelected(prev => prev.includes(county) ? prev.filter(c => c !== county) : [...prev, county])
  }

  const saveModal = async () => {
    await SettingsStore.setRegions(modalState, modalSelected)
    // refresh local regions
    const all = await SettingsStore.get()
    setRegions(all?.regions || {})
    setIsAdding(false)
  }

  const selectedStates = Object.keys(regions).filter(k => (regions[k]||[]).length > 0)

  return (
    <div className="max-w-xl">
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Counties</CardTitle>
          <Button
            onClick={openAdd}
            variant="default"
            borderRadius="999px"
            className="h-9 gap-2 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 pt-4 pb-4">
            {selectedStates.length === 0 ? (
              <p className="text-heading-subdued text-sm">No counties selected yet.</p>
            ) : (
              <div className="space-y-4">
                {selectedStates.map(code => (
                  <div key={code}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-heading-subdued font-medium">{US_STATES.find(s=>s.code===code)?.name || code}</div>
                        <Button
                          variant="outline"
                          borderRadius="1rem"
                          className="h-8 px-3"
                          onClick={() => {
                            setIsAdding(true)
                            loadModalForState(code)
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    <div className="flex flex-wrap gap-2">
                      {(regions[code]||[]).map(c => (
                        <span key={c} className="county-chip">{c} County</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setIsAdding(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[rgba(9,16,33,0.9)] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Select Counties</h3>
                <div className="w-52">
                  <Select value={modalState} onValueChange={(v)=>{ loadModalForState(v) }}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-4 max-h-[60vh] overflow-auto space-y-2">
                {modalCounties.map(c => (
                  <label key={c} className="flex items-center gap-2 text-neutral-800">
                    <Checkbox checked={modalSelected.includes(c)} onCheckedChange={() => toggleModalCounty(c)} />
                    <span>{c} County</span>
                  </label>
                ))}
              </div>
              <div className="p-4 border-t border-[rgba(147,165,197,0.2)] flex justify-end gap-2">
                <Button
                  variant="outline"
                  borderRadius="1rem"
                  className="px-4"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  borderRadius="1rem"
                  className="gap-2 px-5"
                  disabled={arraysEqual(modalSelected, modalOriginal)}
                  onClick={saveModal}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
