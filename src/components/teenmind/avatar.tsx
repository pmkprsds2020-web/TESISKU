'use client'

import { motion } from 'framer-motion'

export type AvatarMood = 'wave' | 'happy' | 'think' | 'sleep' | 'encourage' | 'celebrate' | 'calm'

export type AvatarProps = {
  mood?: AvatarMood
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const MOOD_EMOJI: Record<AvatarMood, string> = {
  wave: '👋',
  happy: '😊',
  think: '🤔',
  sleep: '😴',
  encourage: '💪',
  celebrate: '🎉',
  calm: '😌',
}

const MOOD_GRADIENT: Record<AvatarMood, string> = {
  wave: 'from-violet-300 to-sky-300',
  happy: 'from-emerald-300 to-teal-300',
  think: 'from-sky-300 to-indigo-300',
  sleep: 'from-indigo-300 to-violet-300',
  encourage: 'from-amber-300 to-orange-300',
  celebrate: 'from-rose-300 to-amber-300',
  calm: 'from-teal-300 to-emerald-300',
}

export function Avatar({ mood = 'happy', message, size = 'md', className }: AvatarProps) {
  const dim = size === 'sm' ? 'h-12 w-12 text-2xl' : size === 'lg' ? 'h-24 w-24 text-5xl' : 'h-16 w-16 text-3xl'
  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <motion.div
        className={`relative flex-shrink-0 ${dim} rounded-full bg-gradient-to-br ${MOOD_GRADIENT[mood]} shadow-lg ring-4 ring-white/60 flex items-center justify-center animate-float`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        key={mood}
      >
        <span className="drop-shadow-sm">{MOOD_EMOJI[mood]}</span>
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/80" />
      </motion.div>
      {message && (
        <motion.div
          initial={{ opacity: 0, x: -10, y: 5 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          className="relative mt-1 max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-md ring-1 ring-black/5"
        >
          {message}
          <span className="absolute -left-1 top-3 h-2 w-2 rotate-45 bg-white" />
        </motion.div>
      )}
    </div>
  )
}
