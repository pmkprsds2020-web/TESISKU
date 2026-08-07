'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase-browser'
import { Loader2, ShieldCheck, Check, X } from 'lucide-react'

const PASSWORD_CHECKS = [
  { label: 'Minimal 8 karakter', test: (v: string) => v.length >= 8 },
  { label: 'Huruf besar (A-Z)', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Huruf kecil (a-z)', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Angka (0-9)', test: (v: string) => /\d/.test(v) },
  { label: 'Karakter spesial (!@#$...)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [sessionOk, setSessionOk] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // The Supabase browser client auto-parses the recovery token from the
    // URL (hash or PKCE code) on load, then fires PASSWORD_RECOVERY once
    // a session is established from it.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionOk(true)
        setReady(true)
      }
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionOk(true)
      setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const passwordOk = PASSWORD_CHECKS.every((c) => c.test(password))
  const passwordsMatch = password.length > 0 && password === confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
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
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    } catch {
      setError('Koneksi bermasalah.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-400 to-emerald-400 text-white shadow-lg ring-6 ring-white/50">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Buat Password Baru</h1>
        </motion.div>

        {!ready && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {ready && !sessionOk && !done && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-600 ring-1 ring-rose-100">
            Tautan reset password tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru dari halaman{' '}
            <Link href="/forgot-password" className="underline">Lupa Password</Link>.
          </div>
        )}

        {done && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
            Password berhasil diperbarui. Mengarahkan ke halaman login...
          </div>
        )}

        {ready && sessionOk && !done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">PASSWORD BARU</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl bg-white shadow-sm"
                disabled={loading}
                required
              />
            </div>
            <ul className="grid grid-cols-1 gap-1 rounded-xl bg-muted/40 p-3 text-xs">
              {PASSWORD_CHECKS.map((c) => {
                const ok = c.test(password)
                return (
                  <li key={c.label} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {c.label}
                  </li>
                )
              })}
            </ul>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">KONFIRMASI PASSWORD</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 rounded-2xl bg-white shadow-sm"
                disabled={loading}
                required
              />
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs font-medium text-rose-600">Password tidak sama.</p>
            )}

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-base font-bold text-white shadow-lg hover:from-teal-600 hover:to-emerald-600 disabled:opacity-70"
            >
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : 'Simpan Password Baru'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
