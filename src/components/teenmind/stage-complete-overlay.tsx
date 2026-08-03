'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

export function StageCompleteOverlay({
  show,
  title = 'Hebat!',
  subtitle = 'Kamu sudah menyelesaikan bagian ini.',
  emoji = '🎉',
  onContinue,
  continueLabel = 'Lanjut',
}: {
  show: boolean
  title?: string
  subtitle?: string
  emoji?: string
  onContinue: () => void
  continueLabel?: string
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl ring-1 ring-black/5"
            initial={{ scale: 0.7, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.7, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          >
            <motion.div
              className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-teal-200 text-5xl"
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.7, repeat: 1 }}
            >
              {emoji}
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-6">
              <Button
                size="lg"
                className="w-full rounded-full bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-lg hover:from-sky-600 hover:to-teal-600"
                onClick={onContinue}
              >
                {continueLabel} →
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
