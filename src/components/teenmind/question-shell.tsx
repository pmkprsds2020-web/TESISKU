'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/teenmind/avatar'
import type { AvatarProps } from '@/components/teenmind/avatar'

export function QuestionShell({
  stageIcon,
  stageTitle,
  current,
  total,
  question,
  avatarMood = 'happy',
  avatarMessage,
  children,
}: {
  stageIcon: string
  stageTitle: string
  current: number
  total: number
  question: string
  avatarMood?: AvatarProps['mood']
  avatarMessage?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {/* Stage chip + counter */}
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm ring-1 ring-black/5">
              <span className="text-base">{stageIcon}</span>
              <span>{stageTitle}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm ring-1 ring-black/5">
              <span className="text-primary font-bold">{current}</span>
              <span>/</span>
              <span>{total}</span>
            </div>
          </div>

          {/* Avatar */}
          {avatarMessage && (
            <div className="mb-5">
              <Avatar mood={avatarMood} message={avatarMessage} size="sm" />
            </div>
          )}

          {/* Question card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-black/5"
          >
            <p className="text-balance text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {question}
            </p>
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
