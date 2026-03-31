"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, Save, User } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useAuth } from "@/providers/auth-provider"
import { Button } from "@/components/ui/button"

const inputCls =
  "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const [firstName, setFirstName] = useState(user?.first_name ?? "")
  const [lastName, setLastName] = useState(user?.last_name ?? "")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    // Show preview as data URL (actual upload would need a storage service)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setAvatarPreview(result)
      setAvatarUrl(result)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Name cannot be empty")
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        avatar_url: avatarUrl,
      })
      updateUser({
        first_name: updated.first_name,
        last_name: updated.last_name,
        avatar_url: updated.avatar_url,
      })
      toast.success("Profile updated!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const initials = `${(user?.first_name ?? "?")[0]}${(user?.last_name ?? "")[0]}`.toUpperCase()

  return (
    <div className="p-4 md:p-8 max-w-[640px] mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="font-display font-bold text-[24px] md:text-[30px] text-ink-primary leading-tight">
          Settings
        </h1>
        <p className="font-body text-sm text-ink-secondary mt-1">
          Manage your profile and account preferences
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-[20px] border border-border-light shadow-card p-6 space-y-6">
        <h2 className="font-display font-semibold text-base text-ink-primary">
          Profile Information
        </h2>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-border-light"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-gradient flex items-center justify-center">
                <span className="font-display font-bold text-xl text-white">{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-border-default shadow-sm flex items-center justify-center hover:bg-surface-secondary transition-colors"
              title="Change photo"
            >
              <Camera className="w-3.5 h-3.5 text-ink-secondary" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="font-display font-semibold text-ink-primary">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="font-body text-sm text-ink-secondary">{user?.email}</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 text-[12px] font-medium font-body text-primary-500 hover:text-primary-600 transition-colors"
            >
              Change photo
            </button>
          </div>
        </div>

        {/* Name fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium font-body text-ink-secondary">
              First Name
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium font-body text-ink-secondary">
              Last Name
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className={inputCls}
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium font-body text-ink-secondary">
            Email <span className="text-ink-tertiary font-normal">(cannot be changed)</span>
          </label>
          <input
            value={user?.email ?? ""}
            readOnly
            className={`${inputCls} bg-surface-secondary text-ink-tertiary cursor-not-allowed`}
          />
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium font-body text-ink-secondary">
            Role
          </label>
          <input
            value={user?.role ?? ""}
            readOnly
            className={`${inputCls} bg-surface-secondary text-ink-tertiary cursor-not-allowed capitalize`}
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button variant="gradient" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
