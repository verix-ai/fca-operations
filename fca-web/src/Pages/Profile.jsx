import React, { useState, useRef } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { Camera, Loader2, User, Save, Mail, Lock, Eye, EyeOff, Check, AlertCircle, Bell, MessageSquare, Users, FileText, Megaphone, Sun, Moon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/components/theme/ThemeProvider'

export default function Profile() {
  const { user, updateProfile, updatePassword } = useAuth()

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Account"
        title="Profile"
        description="Manage your personal information, profile picture, and account security."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileInfoSection user={user} updateProfile={updateProfile} />
        <SecuritySection updatePassword={updatePassword} />
      </div>

      {/* Notification Preferences */}
      <NotificationPreferencesSection user={user} updateProfile={updateProfile} />

      {/* Future sections placeholder */}
      {/* <ActivityHistorySection /> */}
    </div>
  )
}

function ProfileInfoSection({ user, updateProfile }) {
  const [name, setName] = useState(user?.name || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const hasChanges = name !== (user?.name || '') || avatarUrl !== (user?.avatar_url || '')

  const handleAvatarClick = () => {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Image must be smaller than 5MB.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const filePath = `users/${user.id}/avatar.${ext}`

      // Delete existing avatar if it exists
      if (avatarUrl) {
        try {
          const url = new URL(avatarUrl)
          const pathParts = url.pathname.split('/')
          const storagePath = pathParts.slice(pathParts.indexOf('profile-images') + 1).join('/').split('?')[0]
          if (storagePath) {
            await supabase.storage.from('profile-images').remove([storagePath])
          }
        } catch (e) {
          // Ignore errors when removing old image
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath)

      // Add cache-busting parameter
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`
      setAvatarUrl(newUrl)
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setError('Failed to upload image. Please try again.')
    }

    setIsUploading(false)
    e.target.value = ''
  }

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return

    setIsUploading(true)
    setError(null)

    try {
      const url = new URL(avatarUrl)
      const pathParts = url.pathname.split('/')
      const storagePath = pathParts.slice(pathParts.indexOf('profile-images') + 1).join('/').split('?')[0]

      if (storagePath) {
        await supabase.storage.from('profile-images').remove([storagePath])
      }

      setAvatarUrl('')
    } catch (err) {
      console.error('Error removing avatar:', err)
      setError('Failed to remove image. Please try again.')
    }

    setIsUploading(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { error: updateError } = await updateProfile({
        name: name.trim(),
        avatar_url: avatarUrl || null
      })

      if (updateError) throw updateError

      setSuccessMessage('Profile updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error saving profile:', err)
      setError(err.message || 'Failed to save changes.')
    }

    setIsSaving(false)
  }

  return (
    <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-heading-primary">Personal Information</CardTitle>
        <p className="text-sm text-heading-subdued mt-1">Update your profile photo and display name</p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl">
            <Check className="w-4 h-4 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            className="relative h-24 w-24 rounded-2xl border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] flex items-center justify-center overflow-hidden cursor-pointer group shadow-lg"
            onClick={handleAvatarClick}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-[rgba(var(--muted),0.6)]" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-[rgba(var(--muted),0.5)]" />
            )}
            {!isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <Button
              variant="outline"
              borderRadius="1rem"
              className="text-sm"
              onClick={handleAvatarClick}
              disabled={isUploading}
            >
              {avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {avatarUrl && (
              <Button
                variant="ghost"
                borderRadius="1rem"
                className="text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={handleRemoveAvatar}
                disabled={isUploading}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* Name Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-heading-primary">Display Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-xl"
          />
        </div>

        {/* Email (read-only for now) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-heading-primary flex items-center gap-2">
            <Mail className="w-4 h-4 text-heading-subdued" />
            Email Address
          </label>
          <Input
            value={user?.email || ''}
            disabled
            className="rounded-xl bg-[rgba(var(--bg),0.5)]"
          />
          <p className="text-xs text-heading-subdued">Contact support to change your email address.</p>
        </div>

        {/* Theme Toggle */}
        <ThemeToggleRow />

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            variant="default"
            borderRadius="1rem"
            className="gap-2 px-6"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ThemeToggleRow() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-[rgba(var(--border),0.25)] bg-[rgba(var(--bg),0.5)]">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgba(var(--muted),0.7)]">
          {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-sm font-medium text-heading-primary">Dark Mode</p>
          <p className="text-xs text-heading-subdued">Use dark theme</p>
        </div>
      </div>
      <Switch checked={isDark} onCheckedChange={toggleTheme} />
    </div>
  )
}

function SecuritySection({ updatePassword }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isChanging, setIsChanging] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)
  const [error, setError] = useState(null)

  const canSubmit = newPassword.length >= 6 && newPassword === confirmPassword

  const handleChangePassword = async () => {
    if (!canSubmit) return

    setIsChanging(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { error: pwError } = await updatePassword(newPassword)

      if (pwError) throw pwError

      setSuccessMessage('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error changing password:', err)
      setError(err.message || 'Failed to change password.')
    }

    setIsChanging(false)
  }

  return (
    <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-heading-primary flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Security
        </CardTitle>
        <p className="text-sm text-heading-subdued mt-1">Change your password to keep your account secure</p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl">
            <Check className="w-4 h-4 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* New Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-heading-primary">New Password</label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(var(--muted),0.6)] hover:text-[rgb(var(--text))]"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {newPassword && newPassword.length < 6 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Password must be at least 6 characters</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-heading-primary">Confirm New Password</label>
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(var(--muted),0.6)] hover:text-[rgb(var(--text))]"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-600 dark:text-red-400">Passwords do not match</p>
          )}
        </div>

        {/* Change Password Button */}
        <div className="flex justify-end pt-2">
          <Button
            variant="default"
            borderRadius="1rem"
            className="gap-2 px-6"
            onClick={handleChangePassword}
            disabled={!canSubmit || isChanging}
          >
            {isChanging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Changing...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Change Password
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const DEFAULT_NOTIFICATION_PREFS = {
  in_app: {
    referral_created: true,
    phase_completed: true,
    message_received: true,
    client_updated: true,
    general: true
  },
  email: {
    enabled: false,
    digest: 'none'
  }
}

const NOTIFICATION_TYPES = [
  {
    key: 'referral_created',
    label: 'New Referrals',
    description: 'When a new client referral is submitted',
    icon: Users
  },
  {
    key: 'phase_completed',
    label: 'Phase Completions',
    description: 'When a client completes a workflow phase',
    icon: Check
  },
  {
    key: 'message_received',
    label: 'Messages',
    description: 'When you receive a new message',
    icon: MessageSquare
  },
  {
    key: 'client_updated',
    label: 'Client Updates',
    description: 'When client records are modified',
    icon: FileText
  },
  {
    key: 'general',
    label: 'General Announcements',
    description: 'System updates and announcements',
    icon: Megaphone
  }
]

function NotificationPreferencesSection({ user, updateProfile }) {
  const [preferences, setPreferences] = useState(() => {
    return user?.notification_preferences || DEFAULT_NOTIFICATION_PREFS
  })
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)
  const [error, setError] = useState(null)

  const originalPrefs = user?.notification_preferences || DEFAULT_NOTIFICATION_PREFS
  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPrefs)

  const handleToggle = (category, key) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key]
      }
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { error: updateError } = await updateProfile({
        notification_preferences: preferences
      })

      if (updateError) throw updateError

      setSuccessMessage('Notification preferences saved')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error saving notification preferences:', err)
      setError(err.message || 'Failed to save preferences.')
    }

    setIsSaving(false)
  }

  return (
    <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-heading-primary flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
        <p className="text-sm text-heading-subdued mt-1">Choose which notifications you want to receive</p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl">
            <Check className="w-4 h-4 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* In-App Notifications */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-heading-primary uppercase tracking-wider">In-App Notifications</h3>
          <div className="space-y-3">
            {NOTIFICATION_TYPES.map(({ key, label, description, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-xl border border-[rgba(var(--border),0.25)] bg-[rgba(var(--bg),0.5)] hover:bg-[rgba(var(--bg),0.8)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgba(var(--muted),0.7)]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-heading-primary">{label}</p>
                    <p className="text-xs text-heading-subdued">{description}</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.in_app?.[key] ?? true}
                  onCheckedChange={() => handleToggle('in_app', key)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Email Notifications */}
        <div className="space-y-4 pt-4 border-t border-[rgba(var(--border),0.2)]">
          <h3 className="text-sm font-semibold text-heading-primary uppercase tracking-wider">Email Notifications</h3>
          <div className="flex items-center justify-between p-3 rounded-xl border border-[rgba(var(--border),0.25)] bg-[rgba(var(--bg),0.5)]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgba(var(--muted),0.7)]">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-heading-primary">Email Notifications</p>
                <p className="text-xs text-heading-subdued">Receive notifications via email</p>
              </div>
            </div>
            <Switch
              checked={preferences.email?.enabled ?? false}
              onCheckedChange={() => handleToggle('email', 'enabled')}
            />
          </div>
          <p className="text-xs text-heading-subdued px-1">
            Email notifications are coming soon. When enabled, you'll receive important updates at {user?.email}.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            variant="default"
            borderRadius="1rem"
            className="gap-2 px-6"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
