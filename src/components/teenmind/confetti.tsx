'use client'

import { motion, AnimatePresence } from 'framer-motion'

const COLORS = ['#7dd3c0', '#a5b4fc', '#fcd34d', '#f9a8d4', '#86efac', '#7dd3fc', '#fdba74']

export function Confetti({ show, count = 40 }: { show: boolean; count?: number }) {
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
          {Array.from({ length: count }).map((_, i) => {
            const left = Math.random() * 100
            const delay = Math.random() * 0.5
            const duration = 2.5 + Math.random() * 1.5
            const size = 6 + Math.random() * 8
            const color = COLORS[i % COLORS.length]
            const shape = i % 3
            return (
              <motion.div
                key={i}
                className="absolute top-0"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size,
                  backgroundColor: color,
                  borderRadius: shape === 0 ? '50%' : shape === 1 ? '2px' : '0',
                }}
                initial={{ y: -20, opacity: 1, rotate: 0 }}
                animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 720 }}
                transition={{ duration, delay, ease: 'easeIn' }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
