import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Check, Trash2, X, Loader2, Eye, ExternalLink } from 'lucide-react'
import { Notification } from '@/entities/Notification.supabase'
import { useNavigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  const navigate = useNavigate()

  // Load unread count
  useEffect(() => {
    loadUnreadCount()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Subscribe to real-time notifications
  useEffect(() => {
    const subscription = Notification.subscribe((newNotification) => {
      // Update unread count and notifications list
      loadUnreadCount()
      if (isOpen) {
        loadNotifications()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isOpen])

  const loadUnreadCount = async () => {
    try {
      const count = await Notification.getUnreadCount()
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const notifs = await Notification.list({ limit: 20 })
      setNotifications(notifs)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkAsRead = async (id, event) => {
    event.stopPropagation()
    try {
      await Notification.markAsRead(id)
      await loadNotifications()
      await loadUnreadCount()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await Notification.markAllAsRead()
      await loadNotifications()
      await loadUnreadCount()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleDelete = async (id, event) => {
    event.stopPropagation()
    try {
      await Notification.remove(id)
      await loadNotifications()
      await loadUnreadCount()
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await Notification.markAsRead(notification.id)
      await loadUnreadCount()
    }

    // Navigate to related entity if applicable
    if (notification.related_entity_type && notification.related_entity_id) {
      setIsOpen(false)
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
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      case 'phase_completed':
        return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 'message_received':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
      case 'client_updated':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
    }
  }

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownHeight = 600 // Approximate max height (80vh is roughly this)
      const viewportHeight = window.innerHeight
      
      // Check if dropdown would go off bottom of screen
      let top = rect.top
      if (top + dropdownHeight > viewportHeight) {
        // Position it so bottom aligns with viewport bottom, with some padding
        top = Math.max(20, viewportHeight - dropdownHeight - 20)
      }
      
      setDropdownPosition({
        top: top,
        left: rect.right + 16 // 16px gap from the button
      })
    }
    setIsOpen(!isOpen)
  }

  const dropdownContent = isOpen && (
        <div 
          className="fixed z-[9999] w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl max-h-[80vh] overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            backgroundColor: '#1a1a1a',
            borderColor: '#333'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-700 p-4">
            <div>
              <h3 className="text-lg font-semibold text-heading-primary">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-heading-subdued">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.some(n => !n.is_read) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="h-8 px-3 text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-heading-subdued opacity-50 mb-3" />
                <p className="text-heading-subdued">No notifications yet</p>
                <p className="text-xs text-heading-subdued mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      relative p-4 transition-colors cursor-pointer
                      ${!notification.is_read ? 'bg-gray-800' : 'bg-transparent'}
                      hover:bg-gray-700
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getNotificationColor(notification.type)}`}>
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-heading-primary">
                            {notification.title}
                          </h4>
                          {!notification.is_read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-brand mt-1" />
                          )}
                        </div>
                        <p className="text-sm text-heading-subdued line-clamp-2 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-heading-subdued">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          <div className="flex items-center gap-1">
                            {!notification.is_read && (
                              <button
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white"
                                aria-label="Mark as read"
                                title="Mark as read"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(notification.id, e)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                              aria-label="Delete"
                              title="Delete notification"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-700 p-3">
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate(createPageUrl('Notifications'))
                }}
                className="w-full rounded-xl bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                View all notifications
                <ExternalLink className="inline-block ml-2 h-3 w-3" />
              </button>
            </div>
          )}
        </div>
  )

  return (
    <>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgba(var(--muted),0.8)] transition-colors hover:border-[rgba(var(--border),0.55)] hover:text-[rgb(var(--text))]"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - Rendered via Portal to escape sidebar */}
      {isOpen && createPortal(
        <div ref={dropdownRef}>
          {dropdownContent}
        </div>,
        document.body
      )}
    </>
  )
}

