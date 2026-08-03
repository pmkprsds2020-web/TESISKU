'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore, type SessionData } from '@/lib/store'
import { Avatar } from '@/components/teenmind/avatar'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'

export function LoginScreen() {
  const setMode = useAppStore((s) => s.setMode)
  const setSession = useAppStore((s) => s.setSession)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim()) {
      setError('Masukkan kode penelitian kamu.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal masuk.')
        setLoading(false)
        return
      }
      if (data.admin) {
        setMode('admin-login')
        setLoading(false)
        return
      }
      setSession(data as SessionData)
      setMode('loading')
    } catch {
      setError('Koneksi bermasalah. Coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
      <div className="pointer-events-none absolute -right-16 top-20 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-8">
        <button
          onClick={() => setMode('welcome')}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>

        <div className="flex flex-1 flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-300 to-sky-300 text-4xl shadow-lg ring-6 ring-white/50">
              <KeyRound className="h-9 w-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Masuk dengan Kode</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Masukkan kode penelitian yang diberikan peneliti, contoh:
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-mono font-semibold text-primary ring-1 ring-black/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> SMP001001
            </div>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SMP001001"
                autoCapitalize="characters"
                autoCorrect="off"
                className="h-14 rounded-2xl border-2 bg-white/80 text-center text-lg font-mono font-bold tracking-widest text-foreground shadow-sm ring-1 ring-black/5 focus-visible:ring-primary"
                disabled={loading}
                inputMode="text"
              />
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 ring-1 ring-rose-100"
              >
                {error}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-14 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-teal-500 text-lg font-bold text-white shadow-xl shadow-teal-500/30 hover:from-sky-600 hover:to-teal-600 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memeriksa...
                  </>
                ) : (
                  'Masuk →'
                )}
              </Button>
            </motion.div>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <Avatar mood="think" message="Tidak punya kode? Tanyakan ke gurumu ya 😊" size="sm" className="mx-auto justify-center" />
          </motion.div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70">
          Kode bersifat unik & rahasia. Jangan dibagikan ke teman.
        </p>
      </div>
    </div>
  )
}
