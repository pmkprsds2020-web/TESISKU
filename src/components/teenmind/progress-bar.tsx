'use client'

import { motion } from 'framer-motion'

export function ProgressBar({
  percent,
  estimatedMinutesLeft,
  stageLabel,
  className,
}: {
  percent: number
  estimatedMinutesLeft?: number
  stageLabel?: string
  className?: string
}) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {stageLabel && <span className="text-foreground/80">{stageLabel}</span>}
          <span className="text-primary font-semibold">{p}%</span>
        </span>
        {estimatedMinutesLeft != null && (
          <span className="flex items-center gap-1">
            <span>⏱</span>
            <span>~{estimatedMinutesLeft} menit lagi</span>
          </span>
        )}
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/70">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
        </motion.div>
        {/* milestone dots */}
        {[25, 50, 75].map((m) => (
          <div
            key={m}
            className={`absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${p >= m ? 'bg-white' : 'bg-muted-foreground/30'}`}
            style={{ left: `${m}%` }}
          />
        ))}
      </div>
    </div>
  )
}
