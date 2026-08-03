'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/teenmind/avatar'
import { ThemeToggle } from '@/components/teenmind/theme-toggle'
import { useAppStore } from '@/lib/store'
import { ShieldCheck, Clock, Heart, Lock } from 'lucide-react'

export function WelcomeScreen() {
  const setMode = useAppStore((s) => s.setMode)

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-mesh">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl" />
      {/* Theme toggle - top right */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute -right-16 top-40 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-10 pt-12">
        {/* brand */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2"
        >
          <span className="text-2xl">🧠</span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            TeenMind <span className="text-primary">Research</span>
          </span>
        </motion.div>

        <div className="flex flex-1 flex-col justify-center py-8">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.1 }}
            className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-sky-300 via-teal-300 to-emerald-300 text-7xl shadow-xl ring-8 ring-white/50"
          >
            👋
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3 text-center"
          >
            <h1 className="text-balance text-3xl font-extrabold leading-tight text-foreground">
              Kenali Dirimu, <br />
              <span className="bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent">
                Jaga Kesehatan Mental
              </span>
            </h1>
            <p className="text-balance text-base text-muted-foreground">
              Terima kasih sudah bersedia membantu penelitian ini. Kami ingin
              mengetahui bagaimana kesehatan, kehidupan sekolah, tidur, penggunaan
              media sosial, dan perasaanmu.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 grid grid-cols-2 gap-3"
          >
            {[
              { icon: Heart, label: 'Tidak ada jawaban benar/salah', color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300' },
              { icon: Lock, label: 'Semua jawaban rahasia', color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300' },
              { icon: Clock, label: '~28 menit', color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300' },
              { icon: ShieldCheck, label: 'Dapat dihentikan kapan saja', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded-2xl bg-white/70 p-3 ring-1 ring-black/5 backdrop-blur dark:bg-white/5 dark:ring-white/10">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${f.color}`}>
                  <f.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium leading-tight text-foreground/80 dark:text-foreground/90">{f.label}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-8"
          >
            <Avatar mood="wave" message="Halo! Aku Mindi, teman kamu di sini 🌸" size="md" className="mx-auto justify-center" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-8 space-y-3"
          >
            <Button
              size="lg"
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-teal-500 text-lg font-bold text-white shadow-xl shadow-teal-500/30 hover:from-sky-600 hover:to-teal-600"
              onClick={() => setMode('login')}
            >
              Mulai →
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setMode('admin-login')}
            >
              Masuk sebagai Peneliti
            </Button>
          </motion.div>
        </div>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Penelitian Tesis · Faktor Biopsikososial Depresi Remaja SMP ·
          Disetujui Komite Etik
        </p>
      </div>
    </div>
  )
}
