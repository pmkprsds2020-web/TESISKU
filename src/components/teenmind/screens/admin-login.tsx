'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'

export function AdminLoginScreen() {
  const setMode = useAppStore((s) => s.setMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal masuk.')
        setLoading(false)
        return
      }
      setMode('admin')
    } catch {
      setError('Koneksi bermasalah.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
      <div className="pointer-events-none absolute -right-16 top-20 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl" />
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
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-400 to-indigo-400 text-white shadow-lg ring-6 ring-white/50">
              <ShieldCheck className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Panel Peneliti</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Masuk untuk melihat data dan analisis penelitian.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">USERNAME</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="h-12 rounded-2xl bg-white shadow-sm"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">PASSWORD</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-2xl bg-white shadow-sm"
                disabled={loading}
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
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-base font-bold text-white shadow-lg hover:from-violet-600 hover:to-indigo-600 disabled:opacity-70"
            >
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memeriksa...</> : 'Masuk →'}
            </Button>
          </form>

          <p className="mt-6 rounded-xl bg-muted/50 p-3 text-center text-xs text-muted-foreground">
            Demo: <span className="font-mono font-semibold text-foreground">admin</span> /{' '}
            <span className="font-mono font-semibold text-foreground">teenmind2025</span>
          </p>
        </div>
      </div>
    </div>
  )
}
