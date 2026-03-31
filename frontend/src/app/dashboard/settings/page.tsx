"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Loader2, Save, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useAuth } from "@/providers/auth-provider"
import { Button } from "@/components/ui/button"

const inputCls =
  "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

// ── Photo cropper ──────────────────────────────────────────────

function PhotoCropper({
  src,
  onCrop,
  onCancel,
}: {
  src: string
  onCrop: (dataUrl: string) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  // fitScale = the scale that makes the image fill the canvas at 1×
  const fitScaleRef = useRef(1)
  // zoomMultiplier: 1 = original fit, 2 = 2× zoom, etc.
  const [zoomMultiplier, setZoomMultiplier] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const CANVAS_SIZE = 240

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const scale = fitScaleRef.current * zoomMultiplier
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const baseX = (CANVAS_SIZE - w) / 2
    const baseY = (CANVAS_SIZE - h) / 2

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.drawImage(img, baseX + offset.x, baseY + offset.y, w, h)

    // Dark overlay with circular cutout
    ctx.save()
    ctx.fillStyle = "rgba(0,0,0,0.4)"
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Circle border
    ctx.beginPath()
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 4, 0, Math.PI * 2)
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2
    ctx.stroke()
  }, [zoomMultiplier, offset])

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => {
      imgRef.current = img
      // fitScale makes the image fill the canvas — this is our "1×" baseline
      fitScaleRef.current = Math.max(
        CANVAS_SIZE / img.naturalWidth,
        CANVAS_SIZE / img.naturalHeight
      )
      setZoomMultiplier(1)
      setOffset({ x: 0, y: 0 })
    }
    img.src = src
  }, [src])

  useEffect(() => { draw() }, [draw])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
  }
  const onMouseUp = () => { dragging.current = false }

  // Touch support
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const dx = e.touches[0].clientX - lastPos.current.x
    const dy = e.touches[0].clientY - lastPos.current.y
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
  }
  const onTouchEnd = () => { dragging.current = false }

  const handleCrop = () => {
    const img = imgRef.current
    if (!img) return

    const out = document.createElement("canvas")
    out.width = CANVAS_SIZE
    out.height = CANVAS_SIZE
    const ctx = out.getContext("2d")!

    ctx.beginPath()
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()

    const scale = fitScaleRef.current * zoomMultiplier
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const baseX = (CANVAS_SIZE - w) / 2
    const baseY = (CANVAS_SIZE - h) / 2
    ctx.drawImage(img, baseX + offset.x, baseY + offset.y, w, h)

    onCrop(out.toDataURL("image/jpeg", 0.9))
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[20px] shadow-2xl p-6 flex flex-col items-center gap-5 w-full max-w-[340px]">
        <h3 className="font-display font-semibold text-base text-ink-primary">Adjust Photo</h3>

        {/* Canvas */}
        <div className="relative select-none">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="rounded-full cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 w-full">
          <ZoomOut className="w-4 h-4 text-ink-tertiary shrink-0" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoomMultiplier}
            onChange={(e) => setZoomMultiplier(parseFloat(e.target.value))}
            className="flex-1 accent-primary-500"
          />
          <ZoomIn className="w-4 h-4 text-ink-tertiary shrink-0" />
        </div>

        <p className="text-[12px] font-body text-ink-tertiary text-center -mt-2">
          Drag to reposition · Use slider to zoom
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-[10px] border border-border-default text-sm font-body text-ink-secondary hover:bg-surface-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 h-10 rounded-[10px] bg-brand-gradient text-white text-sm font-semibold font-body hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Settings page ──────────────────────────────────────────────

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const [firstName, setFirstName] = useState(user?.first_name ?? "")
  const [lastName, setLastName] = useState(user?.last_name ?? "")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Keep fields in sync if user loads asynchronously
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name)
      setLastName(user.last_name)
      setAvatarUrl(user.avatar_url ?? null)
    }
  }, [user])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    // Reset input so same file can be picked again
    e.target.value = ""
  }

  const handleCrop = (dataUrl: string) => {
    setAvatarUrl(dataUrl)
    setCropSrc(null)
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
    <>
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onCrop={handleCrop}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="p-4 md:p-8 max-w-[640px] mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="font-display font-bold text-[24px] md:text-[30px] text-ink-primary leading-tight">
            Settings
          </h1>
          <p className="font-body text-sm text-ink-secondary mt-1">
            Manage your profile and account preferences
          </p>
        </div>

        <div className="bg-white rounded-[20px] border border-border-light shadow-card p-6 space-y-6">
          <h2 className="font-display font-semibold text-base text-ink-primary">
            Profile Information
          </h2>

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-border-light"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-brand-gradient flex items-center justify-center">
                  <span className="font-display font-bold text-2xl text-white">{initials}</span>
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
                onChange={handleFileChange}
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
              {avatarUrl && (
                <button
                  onClick={() => setAvatarUrl(null)}
                  className="mt-1.5 ml-3 text-[12px] font-medium font-body text-ink-tertiary hover:text-danger-500 transition-colors"
                >
                  Remove
                </button>
              )}
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
            <label className="text-[13px] font-medium font-body text-ink-secondary">Role</label>
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
    </>
  )
}
