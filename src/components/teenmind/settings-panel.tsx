'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Check, Plus, X, Settings as SettingsIcon, Target, Mail, Phone, School, ShieldCheck, Clock, Trash2, AlertTriangle } from 'lucide-react'

type Settings = {
  targetRespondents: number
  researchTitle: string
  researcherName: string
  researcherEmail: string
  bkContactName: string
  bkContactPhone: string
  schools: string[]
  ethicsApprovalNumber: string
  dataRetentionDays: number
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newSchool, setNewSchool] = useState('')
  const [cleanupPreview, setCleanupPreview] = useState<{ retentionDays: number; respondents: number; codes: number } | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupDone, setCleanupDone] = useState<{ respondents: number; codes: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => { if (d.settings) setSettings(d.settings as Settings) })
      .finally(() => setLoading(false))
    // Load cleanup preview
    fetch('/api/admin/cleanup')
      .then((r) => r.json())
      .then((d) => {
        if (d.wouldDelete) {
          setCleanupPreview({
            retentionDays: d.retentionDays,
            respondents: d.wouldDelete.respondents,
            codes: d.wouldDelete.codes,
          })
        }
      })
      .catch(() => {})
  }, [])

  async function handleCleanup() {
    if (!confirm('Yakin ingin menghapus data lama? Tindakan ini tidak dapat dibatalkan.')) return
    setCleanupLoading(true)
    try {
      const res = await fetch('/api/admin/cleanup', { method: 'POST' })
      const d = await res.json()
      if (d.deleted) {
        setCleanupDone({ respondents: d.deleted.respondents, codes: d.deleted.codes })
        setCleanupPreview(null)
      }
    } finally {
      setCleanupLoading(false)
    }
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  function addSchool() {
    if (!newSchool.trim() || !settings) return
    if (settings.schools.includes(newSchool.trim())) return
    setSettings({ ...settings, schools: [...settings.schools, newSchool.trim()] })
    setNewSchool('')
  }

  function removeSchool(s: string) {
    if (!settings) return
    setSettings({ ...settings, schools: settings.schools.filter((x) => x !== s) })
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-violet-500 to-indigo-500 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <SettingsIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Pengaturan Penelitian</h3>
              <p className="text-xs text-white/80">Konfigurasi target, kontak, dan parameter penelitian</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="mb-4 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm"
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : saved ? <Check className="mr-1.5 h-4 w-4" /> : <Save className="mr-1.5 h-4 w-4" />}
              {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan'}
            </Button>
          </div>

          {/* Target & Retention */}
          <div className="mb-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <Target className="h-4 w-4 text-primary" /> Target & Data
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Target Responden</Label>
                <Input
                  type="number"
                  value={settings.targetRespondents}
                  onChange={(e) => setSettings({ ...settings, targetRespondents: Number(e.target.value) })}
                  className="mt-1"
                  min="1"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Target jumlah responden yang dibutuhkan</p>
              </div>
              <div>
                <Label className="text-xs">Retensi Data (hari)</Label>
                <Input
                  type="number"
                  value={settings.dataRetentionDays}
                  onChange={(e) => setSettings({ ...settings, dataRetentionDays: Number(e.target.value) })}
                  className="mt-1"
                  min="30"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Lama data disimpan sebelum dihapus otomatis</p>
              </div>
            </div>
          </div>

          {/* Research Info */}
          <div className="mb-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> Informasi Penelitian
            </h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Judul Penelitian</Label>
                <Input
                  value={settings.researchTitle}
                  onChange={(e) => setSettings({ ...settings, researchTitle: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Nomor Persetujuan Etik</Label>
                <Input
                  value={settings.ethicsApprovalNumber}
                  onChange={(e) => setSettings({ ...settings, ethicsApprovalNumber: e.target.value })}
                  className="mt-1"
                  placeholder="Mis. KE/FK/001/2025"
                />
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="mb-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <Mail className="h-4 w-4 text-primary" /> Kontak Peneliti & BK
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Nama Peneliti</Label>
                <Input
                  value={settings.researcherName}
                  onChange={(e) => setSettings({ ...settings, researcherName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Email Peneliti</Label>
                <Input
                  type="email"
                  value={settings.researcherEmail}
                  onChange={(e) => setSettings({ ...settings, researcherEmail: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Nama Guru BK / Konselor</Label>
                <Input
                  value={settings.bkContactName}
                  onChange={(e) => setSettings({ ...settings, bkContactName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Telepon BK</Label>
                <Input
                  value={settings.bkContactPhone}
                  onChange={(e) => setSettings({ ...settings, bkContactPhone: e.target.value })}
                  className="mt-1"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          </div>

          {/* Schools */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <School className="h-4 w-4 text-primary" /> Sekolah Mitra
            </h4>
            <div className="mb-3 flex flex-wrap gap-2">
              {settings.schools.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 py-1 pl-3 pr-1">
                  {s}
                  <button
                    onClick={() => removeSchool(s)}
                    className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {settings.schools.length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada sekolah terdaftar</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSchool}
                onChange={(e) => setNewSchool(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSchool() } }}
                placeholder="Nama sekolah..."
                className="max-w-xs"
              />
              <Button size="sm" variant="outline" onClick={addSchool} className="rounded-lg">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Ethics reminder */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Pengingat Etik Penelitian</p>
            <p className="mt-1">
              Pastikan semua kontak (peneliti & BK) terisi untuk protokol tindak lanjut
              responden high-risk. Data sensitif harus disimpan sesuai kebijakan retensi
              dan dihapus setelah periode penelitian berakhir.
            </p>
          </div>
        </div>
      </Card>

      {/* Data Cleanup */}
      <Card className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Pembersihan Data Otomatis</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hapus data responden yang sudah selesai dan kode tidak terpakai yang lebih lama
              dari periode retensi ({settings.dataRetentionDays} hari).
            </p>
          </div>
        </div>

        {cleanupDone ? (
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300">
            ✅ Berhasil menghapus {cleanupDone.respondents} responden dan {cleanupDone.codes} kode lama.
          </div>
        ) : cleanupPreview ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-rose-50 p-2.5 text-center ring-1 ring-rose-100 dark:bg-rose-950/20">
                <p className="text-2xl font-bold text-rose-600">{cleanupPreview.respondents}</p>
                <p className="text-[10px] text-muted-foreground">Responden lama</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2.5 text-center ring-1 ring-amber-100 dark:bg-amber-950/20">
                <p className="text-2xl font-bold text-amber-600">{cleanupPreview.codes}</p>
                <p className="text-[10px] text-muted-foreground">Kode tidak terpakai</p>
              </div>
            </div>
            {(cleanupPreview.respondents > 0 || cleanupPreview.codes > 0) ? (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/20 dark:text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Data yang akan dihapus: responden selesai sebelum{" "}
                  {cleanupPreview.retentionDays} hari terakhir. Tindakan ini permanen.
                </span>
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                ✓ Tidak ada data yang perlu dibersihkan.
              </div>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCleanup}
              disabled={cleanupLoading || (cleanupPreview.respondents === 0 && cleanupPreview.codes === 0)}
              className="w-full gap-1.5"
            >
              {cleanupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Hapus Data Lama
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memeriksa data...
          </div>
        )}
      </Card>

      <ChangePasswordCard />
    </div>
  )
}

// ─── Ganti Password (akun peneliti baru / Supabase Auth) ────────────────
// Hanya berlaku untuk akun yang dibuat lewat halaman Registrasi. Akun
// admin lama (tab "Admin Lama" di layar login) tidak memakai Supabase
// Auth sehingga tidak bisa memakai form ini.
function ChangePasswordCard() {
  const [email, setEmail] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, oldPassword, newPassword, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengubah password.')
        setLoading(false)
        return
      }
      setSuccess(true)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('Koneksi bermasalah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Ganti Password Akun</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Berlaku untuk akun peneliti yang dibuat lewat halaman Registrasi. Isi email akun Anda beserta
        password lama dan password baru.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label className="mb-1.5 block text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Password Lama</Label>
          <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} disabled={loading} required />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Password Baru</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={loading} required />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Konfirmasi Password Baru</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} required />
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300">
            ✅ Password berhasil diperbarui.
          </div>
        )}

        <Button type="submit" size="sm" disabled={loading} className="w-full gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Simpan Password Baru
        </Button>
      </form>
    </Card>
  )
}
