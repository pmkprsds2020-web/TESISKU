'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { LifeBuoy } from 'lucide-react'

export function HighRiskDialog({
  open,
  onAcknowledge,
}: {
  open: boolean
  onAcknowledge: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-rose-900/40 backdrop-blur-md p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-rose-200"
            initial={{ scale: 0.8, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          >
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rose-100/80 blur-xl" />
            <div className="relative">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-200 to-amber-100 text-3xl shadow-inner">
                🫂
              </div>
              <h2 className="text-xl font-bold text-foreground">Kami peduli padamu</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Kami melihat kamu mungkin sedang mengalami masa sulit. Terima kasih sudah
                jujur menjawab. Silakan lanjutkan pengisian — peneliti akan menghubungi
                guru BK atau konselor sekolah sesuai prosedur etik penelitian untuk
                memastikan kamu mendapatkan dukungan yang tepat.
              </p>
              <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm ring-1 ring-rose-100">
                <div className="flex items-center gap-2 font-semibold text-rose-700">
                  <LifeBuoy className="h-4 w-4" /> Butuh bicara sekarang?
                </div>
                <p className="mt-1 text-rose-600/90">
                  Telepon 119 (Konseling Kesehatan Jiwa) atau hubungi guru BK terdekat.
                </p>
              </div>
              <div className="mt-6">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg hover:from-rose-600 hover:to-amber-600"
                  onClick={onAcknowledge}
                >
                  Saya mengerti, lanjutkan
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
