import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Send } from 'lucide-react'
import SectionHeader from '@/components/layout/SectionHeader.jsx'

const MOCK_USERS = [
  { id: 1, name: 'Nataly Chaplack', unread: 10 },
  { id: 2, name: 'Schastchaslav Yurchuk', unread: 2 },
  { id: 3, name: 'Apanovych Lubomudr', unread: 0 },
  { id: 4, name: 'Mary Croostina', unread: 4 },
]

const initialMessages = [
  { id: 1, from: 'nataly', text: "Hello, I am sending today's indicators", ts: 'Fri 2:20pm' },
  { id: 2, from: 'me', text: "Sure thing, I'll have a look today.", ts: 'Fri 8:20pm' },
]

export default function Messages() {
  const [search, setSearch] = useState('')
  const [activeUserId, setActiveUserId] = useState(MOCK_USERS[0].id)
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return MOCK_USERS.filter(u => u.name.toLowerCase().includes(q))
  }, [search])

  const handleSend = () => {
    const text = draft.trim()
    if (!text) return
    setMessages(prev => [...prev, { id: Date.now(), from: 'me', text, ts: 'Now' }])
    setDraft('')
  }

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Communications"
        title="Direct Messages"
        description="Stay synced with caregivers, marketers, and teammates using a focused message hub."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Threads list */}
        <Card className="lg:col-span-4 bg-hero-card border rounded-2xl surface-main">
          <CardHeader className="p-5">
            <CardTitle className="text-heading-primary text-lg">Direct Messages</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-heading-subdued w-4 h-4" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user name" className="pl-12 rounded-xl" />
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {filtered.map(user => (
                <button
                  key={user.id}
                  onClick={() => setActiveUserId(user.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    activeUserId === user.id ? 'chat-list-item chat-list-item--active' : 'chat-list-item'
                  }`}
                >
                  <span className="truncate text-left text-heading-primary">{user.name}</span>
                  {user.unread > 0 && (
                    <Badge className="bg-brand/20 text-button-contrast border-brand/30 px-2 py-0.5">+{user.unread}</Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat panel */}
        <Card className="lg:col-span-8 bg-hero-card border rounded-2xl surface-main flex flex-col min-h-[70vh]">
          <CardHeader className="p-5 border-b border-[rgba(147,165,197,0.2)]">
            <CardTitle className="text-heading-primary text-lg">
              {MOCK_USERS.find(u => u.id === activeUserId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col">
            <div className="flex-1 overflow-auto space-y-3 mb-4">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${m.from === 'me' ? 'bg-brand text-button-contrast' : 'chat-bubble'} max-w-[75%] px-4 py-2 rounded-2xl shadow-sm`}>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <TextareaLike value={draft} onChange={setDraft} placeholder="Write a message" />
              <Button
                onClick={handleSend}
                variant="default"
                borderRadius="1rem"
                className="gap-2 px-5"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TextareaLike({ value, onChange, placeholder }) {
  return (
    <div className="flex-1 border border-[rgba(147,165,197,0.3)] rounded-xl surface-input shadow-input px-3 py-2">
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full h-20 resize-none bg-transparent focus:outline-none text-heading-primary placeholder-muted"
      />
    </div>
  )
}
