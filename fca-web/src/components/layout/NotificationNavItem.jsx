import React, { useEffect, useState, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Notification } from '@/entities/Notification.supabase'
import { createPageUrl } from '@/utils'

/**
 * Custom navigation item for Notifications with unread badge and sound alert
 */
export default function NotificationNavItem({ 
  variant = 'detail', // 'detail' | 'rail' | 'mobile'
  className 
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const audioRef = useRef(null)
  const previousCountRef = useRef(0)

  // Load unread count
  useEffect(() => {
    loadUnreadCount()
    
    // Poll for new notifications every 15 seconds
    const interval = setInterval(loadUnreadCount, 15000)
    return () => clearInterval(interval)
  }, [])

  // Subscribe to real-time notifications
  useEffect(() => {
    const subscription = Notification.subscribe((newNotification) => {
      console.log('🔔 New notification received:', newNotification)
      
      // Play sound if it's a new unread notification
      if (!newNotification.is_read) {
        playNotificationSound()
      }
      
      // Reload count
      loadUnreadCount()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadUnreadCount = async () => {
    try {
      const count = await Notification.getUnreadCount()
      
      // Play sound if count increased (new notification)
      if (count > previousCountRef.current && previousCountRef.current > 0) {
        playNotificationSound()
      }
      
      previousCountRef.current = count
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const playNotificationSound = () => {
    try {
      // Create a simple notification beep using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Configure the sound (a pleasant notification tone)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // First tone
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
      
      // Second tone for a pleasant double-beep
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator()
        const gainNode2 = audioContext.createGain()
        
        oscillator2.connect(gainNode2)
        gainNode2.connect(audioContext.destination)
        
        oscillator2.type = 'sine'
        oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime)
        gainNode2.gain.setValueAtTime(0.2, audioContext.currentTime)
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
        
        oscillator2.start(audioContext.currentTime)
        oscillator2.stop(audioContext.currentTime + 0.2)
      }, 100)
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }

  // Render for detail sidebar (expanded view)
  if (variant === 'detail') {
    return (
      <NavLink
        to={createPageUrl('Notifications')}
        className={({ isActive }) => {
          const baseClasses = 'group flex items-center gap-3 rounded-xl border border-transparent px-4 py-2 text-sm font-medium transition-all motion-safe:duration-300'
          const inactiveClasses = 'text-[rgba(var(--muted),0.75)] hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.18)] hover:text-[rgb(var(--text))]'
          const activeClasses = 'border-[rgba(var(--brand),0.45)] bg-[rgba(255,255,255,0.12)] text-[rgb(var(--text))] shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)]'
          
          return `${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${className || ''}`
        }}
        title="Notifications"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgba(var(--muted),0.8)] shadow-[0_12px_24px_-20px_rgba(0,0,0,0.65)] transition-colors group-hover:border-[rgba(var(--border),0.55)] group-hover:text-[rgb(var(--text))]">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col text-left">
          <span>Notifications</span>
        </span>
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </NavLink>
    )
  }

  // Render for rail sidebar (collapsed view)
  if (variant === 'rail') {
    return (
      <NavLink
        to={createPageUrl('Notifications')}
        className={({ isActive }) => {
          const baseClasses = 'group flex h-12 w-12 items-center justify-center rounded-xl border transition-all motion-safe:duration-300'
          const inactiveClasses = 'border-transparent text-[rgba(var(--muted),0.75)] hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.22)] hover:text-[rgb(var(--text))]'
          const activeClasses = 'border-[rgba(var(--brand),0.45)] bg-[rgba(var(--border),0.35)] text-[rgb(var(--text))] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)]'
          
          return `${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${className || ''}`
        }}
        title="Notifications"
      >
        <div className="relative">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="sr-only">Notifications</span>
      </NavLink>
    )
  }

  // Render for mobile navigation
  return (
    <NavLink
      to={createPageUrl('Notifications')}
      className={({ isActive }) => {
        const baseClasses = 'flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-[rgba(var(--muted),0.75)] transition-colors'
        const inactiveClasses = 'hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.12)] hover:text-[rgb(var(--text))]'
        const activeClasses = 'border-[rgba(var(--brand),0.45)] bg-[rgba(var(--border),0.2)] text-[rgb(var(--text))]'
        
        return `${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${className || ''}`
      }}
    >
      <div className="relative">
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
      <span className="flex-1 text-left">Notifications</span>
      {unreadCount > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </NavLink>
  )
}


