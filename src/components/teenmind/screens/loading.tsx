'use client'

import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const setMode = useAppStore((s) => s.setMode)
  useEffect(() => {
    const t = setTimeout(() => {
      onDone()
    }, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-mesh px-6">
      <div className="pointer-events-none absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-1/3 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />

      <div className="relative flex flex-col items-center">
        <motion.div
          className="relative flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-sky-300 via-teal-300 to-emerald-300 text-6xl shadow-2xl ring-8 ring-white/50"
          animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✨
          {/* orbiting dots */}
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute h-3 w-3 rounded-full bg-white shadow"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.3 }}
              style={{
                transformOrigin: '60px center',
              }}
            />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-lg font-semibold text-foreground"
        >
          Menyiapkan pertanyaan...
        </motion.p>

        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-primary"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>

        <button
          onClick={() => setMode('welcome')}
          className="mt-10 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Kembali
        </button>
      </div>
    </div>
  )
}
