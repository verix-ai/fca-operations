import React, { useEffect, useState } from 'react'
import Program from '@/entities/Program.supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Save } from 'lucide-react'
import SectionHeader from '@/components/layout/SectionHeader.jsx'

export default function Programs() {
  const [programs, setPrograms] = useState([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

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
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Configuration"
        title="Programs"
        description="Manage the available care programs and keep naming aligned across your intake workflows."
      />

      <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
        <CardHeader className="p-6">
          <CardTitle className="text-heading-primary">Add Program</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={newName}
              onChange={(e)=>setNewName(e.target.value)}
              placeholder="Program name"
              className="rounded-xl"
            />
            <Button
              onClick={addProgram}
              variant="default"
              borderRadius="1rem"
              className="gap-2 px-5"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
        <CardHeader className="p-6">
          <CardTitle className="text-heading-primary">All Programs</CardTitle>
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
    </div>
  )
}
