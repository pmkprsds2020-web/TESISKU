'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Option = {
  value: number | string
  label: string
  emoji?: string
  description?: string
  color: string // tailwind gradient + border classes applied via data-selected
}

export function RadioCardGroup<T extends string | number>({
  options,
  value,
  onChange,
  columns = 1,
  autoNextDelay,
}: {
  options: Option[]
  value: T | undefined
  onChange: (v: T) => void
  columns?: 1 | 2
  autoNextDelay?: number
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
      )}
      role="radiogroup"
    >
      {options.map((opt, idx) => {
        const selected = value === opt.value
        return (
          <motion.button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            data-selected={selected}
            onClick={() => onChange(opt.value as T)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'group relative flex items-center gap-4 rounded-2xl border-2 bg-gradient-to-br p-4 text-left transition-all duration-200',
              opt.color,
              selected ? 'shadow-lg ring-2 ring-offset-2 ring-offset-white ring-primary/40' : 'hover:shadow-md hover:border-foreground/20'
            )}
          >
            {opt.emoji && (
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/70 text-2xl shadow-sm">
                {opt.emoji}
              </span>
            )}
            <span className="flex-1">
              <span className="block font-semibold text-foreground">{opt.label}</span>
              {opt.description && (
                <span className="block text-xs text-muted-foreground">{opt.description}</span>
              )}
            </span>
            <span
              className={cn(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all',
                selected ? 'border-primary bg-primary text-white' : 'border-muted-foreground/30 bg-white'
              )}
            >
              {selected && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              )}
            </span>
          </motion.button>
        )
      })}
      {/* autoNextDelay hidden flag — used by parent to trigger auto next */}
      {autoNextDelay != null && <span className="hidden">{autoNextDelay}</span>}
    </div>
  )
}
