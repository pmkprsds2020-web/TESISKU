'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase-browser'
import { ArrowLeft, Loader2, KeyRound, MailCheck } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setSent(true)
    } catch {
      setError('Koneksi bermasalah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-8">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-lg ring-6 ring-white/50">
              {sent ? <MailCheck className="h-9 w-9" /> : <KeyRound className="h-9 w-9" />}
            </div>
            <h1 className="text-2xl font-bold text-foreground">Lupa Password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent
                ? 'Tautan reset password sudah dikirim. Cek kotak masuk (dan folder spam) email Anda.'
                : 'Masukkan email akun Anda, kami akan kirimkan tautan untuk membuat password baru.'}
            </p>
          </motion.div>

          {!sent && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">EMAIL</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="h-12 rounded-2xl bg-white shadow-sm"
                  disabled={loading}
                  required
                />
              </div>

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
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-base font-bold text-white shadow-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-70"
              >
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Mengirim...</> : 'Kirim Link Reset'}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ingat password Anda?{' '}
            <Link href="/" className="font-semibold text-primary hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
