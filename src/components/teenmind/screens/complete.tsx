'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { Avatar } from '@/components/teenmind/avatar'
import { Confetti } from '@/components/teenmind/confetti'
import { Heart, Sparkles, ShieldCheck } from 'lucide-react'

export function CompleteScreen() {
  const session = useAppStore((s) => s.session)
  const reset = useAppStore((s) => s.reset)

  async function handleFinish() {
    await fetch('/api/progress', { method: 'DELETE' })
    reset()
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
      <Confetti show count={60} />
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-20 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 12 }}
          className="mb-6 flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-300 via-teal-300 to-sky-300 text-7xl shadow-2xl ring-8 ring-white/50"
        >
          🎉
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-3xl font-extrabold text-foreground">Terima Kasih!</h1>
          <p className="mt-3 text-balance text-base text-muted-foreground">
            Kamu telah membantu penelitian ini. Jawabanmu sangat berarti untuk
            memahami dan menjaga kesehatan mental remaja.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 w-full"
        >
          <Avatar mood="celebrate" message="Kamu hebat sudah menyelesaikan semuanya! 🌟" size="md" className="mx-auto justify-center" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid w-full grid-cols-3 gap-3"
        >
          {[
            { icon: Heart, label: 'Berbagi', color: 'text-rose-500 bg-rose-50' },
            { icon: ShieldCheck, label: 'Rahasia', color: 'text-violet-500 bg-violet-50' },
            { icon: Sparkles, label: 'Bermanfaat', color: 'text-emerald-500 bg-emerald-50' },
          ].map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-white/70 p-3 ring-1 ring-black/5 backdrop-blur">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${f.color}`}>
                <f.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-foreground/80">{f.label}</span>
            </div>
          ))}
        </motion.div>

        {session?.highRisk && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6 w-full rounded-2xl bg-rose-50 p-4 text-left text-sm text-rose-700 ring-1 ring-rose-100"
          >
            <p className="font-semibold">💭 Pesan untukmu</p>
            <p className="mt-1 leading-relaxed">
              Jika kamu merasa sedih atau ingin berbicara dengan seseorang, jangan
              ragu menghubungi guru BK, orang tua, atau telepon <strong>119</strong>{' '}
              (Konseling Kesehatan Jiwa). Kamu tidak sendiri 💙
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 w-full"
        >
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-lg font-bold text-white shadow-xl shadow-teal-500/30 hover:from-emerald-600 hover:to-teal-600"
            onClick={handleFinish}
          >
            Selesai 🌟
          </Button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Kode penelitian: <span className="font-mono font-semibold text-foreground/70">{session?.code}</span>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
