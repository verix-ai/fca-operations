import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, Check, CheckCheck, Trash2, Filter, Loader2, ExternalLink } from 'lucide-react'
import { Notification } from '@/entities/Notification.supabase'
import { useNavigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { format, formatDistanceToNow } from 'date-fns'
import SectionHeader from '@/components/layout/SectionHeader.jsx'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'unread', 'type'
  const [typeFilter, setTypeFilter] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadNotifications()
  }, [filter, typeFilter])

  // Subscribe to real-time notifications
  useEffect(() => {
    const subscription = Notification.subscribe(() => {
      loadNotifications()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [filter, typeFilter])

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      let options = {}
      
      if (filter === 'unread') {
        options.unreadOnly = true
      }
      
      if (typeFilter) {
        options.type = typeFilter
      }

      const notifs = await Notification.list(options)
      setNotifications(notifs)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await Notification.markAsRead(id)
      await loadNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await Notification.markAllAsRead()
      await loadNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleDelete = async (id) => {
    try {
      await Notification.remove(id)
      await loadNotifications()
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const handleClearRead = async () => {
    try {
      await Notification.clearRead()
      await loadNotifications()
    } catch (error) {
      console.error('Error clearing read notifications:', error)
    }
  }

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await Notification.markAsRead(notification.id)
    }

    // Navigate to related entity if applicable
    if (notification.related_entity_type && notification.related_entity_id) {
      switch (notification.related_entity_type) {
        case 'client':
          navigate(createPageUrl('ClientDetail', { id: notification.related_entity_id }))
          break
        case 'referral':
          navigate(createPageUrl('Prospects'))
          break
        case 'message':
          navigate(createPageUrl('Messages'))
          break
        default:
          break
      }
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'referral_created':
        return '📝'
      case 'phase_completed':
        return '✅'
      case 'message_received':
        return '💬'
      case 'client_updated':
        return '👤'
      default:
        return '🔔'
    }
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'referral_created':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
      case 'phase_completed':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
      case 'message_received':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
      case 'client_updated':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
    }
  }

  const getNotificationTypeName = (type) => {
    switch (type) {
      case 'referral_created':
        return 'New Referral'
      case 'phase_completed':
        return 'Phase Complete'
      case 'message_received':
        return 'New Message'
      case 'client_updated':
        return 'Client Update'
      default:
        return 'General'
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Notifications"
        title="Activity Center"
        description="Stay updated with all your notifications and system alerts."
      />

      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-6 border-b border-[rgba(147,165,197,0.2)]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-heading-primary text-2xl flex items-center gap-3">
                <Bell className="w-6 h-6" />
                All Notifications
              </CardTitle>
              {unreadCount > 0 && (
                <p className="text-sm text-heading-subdued mt-1">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.some(n => !n.is_read) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  borderRadius="1rem"
                  className="gap-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </Button>
              )}
              {notifications.some(n => n.is_read) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearRead}
                  borderRadius="1rem"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear read
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={setFilter} className="mb-6">
            <TabsList className="bg-light-chip">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">
                Unread
                {unreadCount > 0 && (
                  <Badge className="ml-2 bg-brand/20 text-button-contrast border-brand/30">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={typeFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(null)}
              borderRadius="999px"
            >
              All Types
            </Button>
            <Button
              variant={typeFilter === 'referral_created' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(typeFilter === 'referral_created' ? null : 'referral_created')}
              borderRadius="999px"
              className="gap-2"
            >
              📝 Referrals
            </Button>
            <Button
              variant={typeFilter === 'phase_completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(typeFilter === 'phase_completed' ? null : 'phase_completed')}
              borderRadius="999px"
              className="gap-2"
            >
              ✅ Phases
            </Button>
            <Button
              variant={typeFilter === 'message_received' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(typeFilter === 'message_received' ? null : 'message_received')}
              borderRadius="999px"
              className="gap-2"
            >
              💬 Messages
            </Button>
          </div>

          {/* Notifications List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="w-16 h-16 text-heading-subdued opacity-50 mb-4" />
              <h3 className="text-lg font-semibold text-heading-primary mb-2">
                No notifications
              </h3>
              <p className="text-heading-subdued">
                {filter === 'unread' 
                  ? "You're all caught up! No unread notifications."
                  : typeFilter
                    ? `No ${getNotificationTypeName(typeFilter).toLowerCase()} notifications.`
                    : "You don't have any notifications yet."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    relative rounded-xl border p-5 transition-all cursor-pointer
                    ${!notification.is_read 
                      ? 'bg-brand/5 border-brand/20 hover:bg-brand/10' 
                      : 'bg-light-chip border-[rgba(147,165,197,0.2)] hover:bg-light-chip/70'
                    }
                  `}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${getNotificationColor(notification.type)}`}>
                      <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-heading-primary">
                              {notification.title}
                            </h3>
                            {!notification.is_read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                            )}
                          </div>
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${getNotificationColor(notification.type)}`}>
                            {getNotificationTypeName(notification.type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMarkAsRead(notification.id)
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-heading-subdued hover:bg-brand/10 hover:text-brand transition-colors"
                              aria-label="Mark as read"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(notification.id)
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-heading-subdued hover:bg-red-500/10 hover:text-red-600 transition-colors"
                            aria-label="Delete"
                            title="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-heading-subdued mb-3 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-heading-subdued">
                          {format(new Date(notification.created_at), 'MMM d, yyyy • h:mm a')} 
                          <span className="mx-2">•</span>
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        {notification.related_entity_type && (
                          <span className="text-xs text-brand flex items-center gap-1">
                            Click to view
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

