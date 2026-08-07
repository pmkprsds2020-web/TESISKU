'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Loader2, UserPlus, Check, X } from 'lucide-react'

const PASSWORD_CHECKS = [
  { label: 'Minimal 8 karakter', test: (v: string) => v.length >= 8 },
  { label: 'Huruf besar (A-Z)', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Huruf kecil (a-z)', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Angka (0-9)', test: (v: string) => /\d/.test(v) },
  { label: 'Karakter spesial (!@#$...)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

const initialForm = {
  fullName: '',
  institution: '',
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  researchTitle: '',
  projectName: '',
  targetRespondents: '100',
  phone: '',
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'confirm-email' | 'success' | null>(null)

  function update<K extends keyof typeof initialForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const passwordOk = PASSWORD_CHECKS.every((c) => c.test(form.password))
  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!agreed) {
      setError('Anda harus menyetujui syarat dan ketentuan.')
      return
    }
    if (!passwordOk) {
      setError('Password belum memenuhi semua syarat keamanan.')
      return
    }
    if (!passwordsMatch) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, targetRespondents: Number(form.targetRespondents) || 100, agreed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mendaftar.')
        setLoading(false)
        return
      }
      if (data.requiresEmailConfirmation) {
        setDone('confirm-email')
      } else {
        setDone('success')
        setTimeout(() => router.push('/'), 1200)
      }
    } catch {
      setError('Koneksi bermasalah.')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
        <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-400 text-white shadow-lg">
            <Check className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {done === 'confirm-email' ? 'Cek Email Anda' : 'Akun Berhasil Dibuat'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {done === 'confirm-email'
              ? 'Kami telah mengirim tautan konfirmasi ke email Anda. Klik tautan tersebut untuk mengaktifkan akun sebelum masuk.'
              : 'Project penelitian baru Anda sudah siap dan kosong. Anda akan diarahkan ke dashboard...'}
          </p>
          {done === 'confirm-email' && (
            <Link href="/" className="mt-6">
              <Button className="rounded-2xl">Kembali ke Login</Button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
      <div className="pointer-events-none absolute -right-16 top-20 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-8">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6 mt-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-400 to-indigo-400 text-white shadow-lg ring-6 ring-white/50">
            <UserPlus className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Daftar Peneliti</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Setiap akun baru mendapat ruang penelitian sendiri, mulai dari nol dan terpisah dari akun lain.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5 pb-10">
          <Section title="Data Diri">
            <Field label="Nama Lengkap" value={form.fullName} onChange={(v) => update('fullName', v)} disabled={loading} required />
            <Field label="Institusi" value={form.institution} onChange={(v) => update('institution', v)} disabled={loading} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => update('email', v)} disabled={loading} required />
            <Field label="Username" value={form.username} onChange={(v) => update('username', v)} disabled={loading} required />
            <Field label="Nomor HP" value={form.phone} onChange={(v) => update('phone', v)} disabled={loading} />
          </Section>

          <Section title="Password">
            <Field label="Password" type="password" value={form.password} onChange={(v) => update('password', v)} disabled={loading} required />
            <ul className="grid grid-cols-1 gap-1 rounded-xl bg-muted/40 p-3 text-xs">
              {PASSWORD_CHECKS.map((c) => {
                const ok = c.test(form.password)
                return (
                  <li key={c.label} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {c.label}
                  </li>
                )
              })}
            </ul>
            <Field label="Konfirmasi Password" type="password" value={form.confirmPassword} onChange={(v) => update('confirmPassword', v)} disabled={loading} required />
            {form.confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs font-medium text-rose-600">Password tidak sama.</p>
            )}
          </Section>

          <Section title="Data Penelitian">
            <Field label="Judul Penelitian" value={form.researchTitle} onChange={(v) => update('researchTitle', v)} disabled={loading} />
            <Field label="Nama Project" value={form.projectName} onChange={(v) => update('projectName', v)} disabled={loading} />
            <Field label="Target Responden" type="number" value={form.targetRespondents} onChange={(v) => update('targetRespondents', v)} disabled={loading} />
          </Section>

          <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} disabled={loading} className="mt-0.5" />
            Saya menyetujui syarat dan ketentuan penggunaan aplikasi ini.
          </label>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 ring-1 ring-rose-100"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-base font-bold text-white shadow-lg hover:from-violet-600 hover:to-indigo-600 disabled:opacity-70"
          >
            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Membuat akun...</> : 'Buat Akun Peneliti'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Sudah punya akun?{' '}
            <Link href="/" className="font-semibold text-primary hover:underline">
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  disabled?: boolean
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label.toUpperCase()} {required && <span className="text-rose-500">*</span>}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="h-12 rounded-2xl bg-white shadow-sm"
      />
    </div>
  )
}
