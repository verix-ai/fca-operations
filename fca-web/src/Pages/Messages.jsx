import React, { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Send, Loader2, User as UserIcon, UserCircle, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { Message } from '@/entities/Message.supabase'
import { User } from '@/entities/User.supabase'
import { useAuth } from '@/auth/AuthProvider'
import { format } from 'date-fns'

import BlastEmailModal from '@/components/BlastEmailModal'

export default function Messages() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [activeUserId, setActiveUserId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isBlastModalOpen, setIsBlastModalOpen] = useState(false)

  // Load conversation list
  useEffect(() => {
    loadConversations()
  }, [])

  // Load messages when active user changes
  useEffect(() => {
    if (activeUserId) {
      loadMessages(activeUserId)
    }
  }, [activeUserId])

  const loadConversations = async () => {
    try {
      setIsLoading(true)
      const conversationList = await Message.getConversationList()

      // Also get all users in organization for starting new conversations
      const allUsers = await User.getActive()

      // Filter out current user from the list
      const otherUsers = allUsers.filter(u => u.id !== user?.id)

      // Create a Set of user IDs we already have conversations with
      const existingUserIds = new Set(conversationList.map(c => c.user.id))

      // Add users we don't have conversations with yet
      const newConversations = otherUsers
        .filter(u => !existingUserIds.has(u.id))
        .map(u => ({
          user: u,
          lastMessage: null,
          unreadCount: 0
        }))

      setConversations([...conversationList, ...newConversations])

      // Set first user as active if none selected
      if (!activeUserId && (conversationList.length > 0 || newConversations.length > 0)) {
        const firstUser = conversationList[0]?.user || newConversations[0]?.user
        if (firstUser) {
          setActiveUserId(firstUser.id)
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async (userId) => {
    try {
      setIsLoadingMessages(true)
      const conversationMessages = await Message.getConversation(userId)
      setMessages(conversationMessages)

      // Mark unread messages as read
      const unreadMessages = conversationMessages.filter(
        m => !m.is_read && m.recipient_id === user?.id
      )
      if (unreadMessages.length > 0) {
        await Promise.all(unreadMessages.map(m => Message.markAsRead(m.id)))
        // Refresh conversation list to update unread counts
        loadConversations()
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return conversations.filter(c =>
      c.user.name?.toLowerCase().includes(q) ||
      c.user.email?.toLowerCase().includes(q)
    )
  }, [search, conversations])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || !activeUserId) return

    try {
      setIsSending(true)
      await Message.send({
        recipient_id: activeUserId,
        subject: 'Direct Message',
        content: text
      })

      setDraft('')
      // Reload messages to show the new one
      await loadMessages(activeUserId)
      // Refresh conversation list
      loadConversations()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const activeUser = conversations.find(c => c.user.id === activeUserId)?.user

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
          <CardHeader className="p-5 flex flex-row items-center justify-between">
            <CardTitle className="text-heading-primary text-lg">Direct Messages</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-brand/20 bg-brand/5 hover:bg-brand/10 hover:text-brand"
                onClick={() => setIsBlastModalOpen(true)}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                Broadcast
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-heading-subdued w-4 h-4" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user name" className="pl-12 rounded-xl" />
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-heading-subdued">
                  <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                filtered.map(conversation => (
                  <button
                    key={conversation.user.id}
                    onClick={() => setActiveUserId(conversation.user.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${activeUserId === conversation.user.id ? 'chat-list-item chat-list-item--active' : 'chat-list-item'
                      }`}
                  >
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate text-heading-primary font-medium">{conversation.user.name}</div>
                      {conversation.lastMessage && (
                        <div className="text-xs text-heading-subdued truncate mt-0.5">
                          {conversation.lastMessage.content}
                        </div>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <Badge className="bg-brand/20 text-button-contrast border-brand/30 px-2 py-0.5 ml-2">
                        {conversation.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat panel */}
        <Card className="lg:col-span-8 bg-hero-card border rounded-2xl surface-main flex flex-col min-h-[70vh]">
          <CardHeader className="p-5 border-b border-[rgba(147,165,197,0.2)]">
            <CardTitle className="text-heading-primary text-lg">
              {activeUser ? (
                <div>
                  <div>{activeUser.name}</div>
                  <div className="text-sm text-heading-subdued font-normal">{activeUser.email}</div>
                </div>
              ) : (
                'Select a conversation'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col">
            <div className="flex-1 overflow-auto space-y-3 mb-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-brand" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-heading-subdued">
                  <div className="text-center">
                    <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map(m => {
                  const isFromMe = m.sender_id === user?.id
                  const activeCaregiver = m.client?.caregivers?.find(c => c.status === 'active')
                  return (
                    <div key={m.id} className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${isFromMe ? 'bg-green-700/80 text-white' : 'chat-bubble'} max-w-[75%] px-4 py-2 rounded-2xl shadow-sm`}>
                        {/* Client/Caregiver Tags */}
                        {m.client && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <Link to={`/client/${m.client.id}`}>
                              <Badge className={`text-xs px-2 py-0.5 gap-1 cursor-pointer ${isFromMe ? 'bg-white/20 text-white border-white/30 hover:bg-white/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30'}`}>
                                <UserCircle className="w-3 h-3" />
                                {m.client.client_name}
                              </Badge>
                            </Link>
                            {activeCaregiver && (
                              <Badge className={`text-xs px-2 py-0.5 gap-1 ${isFromMe ? 'bg-white/20 text-white border-white/30' : 'bg-pink-500/20 text-pink-400 border-pink-500/30'}`}>
                                <Heart className="w-3 h-3" />
                                {activeCaregiver.full_name}
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{m.content}</div>
                        <div className={`text-xs mt-1 ${isFromMe ? 'text-white/70' : 'text-heading-subdued'}`}>
                          {format(new Date(m.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex items-end gap-3">
              <TextareaLike
                value={draft}
                onChange={setDraft}
                placeholder="Write a message"
                disabled={!activeUserId}
              />
              <Button
                onClick={handleSend}
                disabled={!draft.trim() || !activeUserId || isSending}
                variant="default"
                borderRadius="1rem"
                className="gap-2 px-5"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <BlastEmailModal
        isOpen={isBlastModalOpen}
        onClose={() => setIsBlastModalOpen(false)}
      />
    </div>
  )
}

function TextareaLike({ value, onChange, placeholder, disabled }) {
  return (
    <div className={`flex-1 border border-[rgba(147,165,197,0.3)] rounded-xl surface-input shadow-input px-3 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-20 resize-none bg-transparent focus:outline-none text-heading-primary placeholder-muted disabled:cursor-not-allowed"
      />
    </div>
  )
}
