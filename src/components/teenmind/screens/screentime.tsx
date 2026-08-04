'use client'

import { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { SCREEN_TIME_QUESTIONS } from '@/lib/instruments'
import { QuestionShell } from '@/components/teenmind/question-shell'
import { StageCompleteOverlay } from '@/components/teenmind/stage-complete-overlay'
import { Confetti } from '@/components/teenmind/confetti'

const TOTAL = SCREEN_TIME_QUESTIONS.length

export function ScreenTimeScreen() {
  const session = useAppStore((s) => s.session)
  const screentime = useAppStore((s) => s.screentime)
  const patchScreenTime = useAppStore((s) => s.patchScreenTime)
  const [idx, setIdx] = useState(Math.min(session?.stageIndex ?? 0, SCREEN_TIME_QUESTIONS.length - 1))
  const [showComplete, setShowComplete] = useState(false)
  const [saving, setSaving] = useState(false)

  const q = SCREEN_TIME_QUESTIONS[idx]
  // Restore previously saved answer
  const value = q ? screentime[q.id] : undefined

  // PERF (audit finding): selecting an answer scheduled a save via
  // setTimeout(100ms), and clicking next/prev right after fired another
  // save with the same answers — doubling requests per question. Cancel
  // the pending draft save whenever navigation is about to send fresh data.
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelPendingDraft = useCallback(() => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current)
      draftTimer.current = null
    }
  }, [])

  // Navigate next (only via button)
  const goNext = useCallback(() => {
    cancelPendingDraft()
    if (idx + 1 < TOTAL) {
      setIdx(idx + 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx + 1, stage: 'screentime', answers: screentime }),
      })
    } else {
      setSaving(true)
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'screentime', answers: screentime }),
      }).finally(() => {
        setSaving(false)
        setShowComplete(true)
      })
    }
  }, [idx, screentime, TOTAL, cancelPendingDraft])

  // Navigate prev (preserves answers)
  const goPrev = useCallback(() => {
    cancelPendingDraft()
    if (idx > 0) {
      setIdx(idx - 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx - 1, stage: 'screentime', answers: screentime }),
      })
    }
  }, [idx, screentime, cancelPendingDraft])

  if (!q) {
    return null
  }

  const isLast = idx + 1 === TOTAL

  // Handle selection — save draft, stay on same page (NO auto-advance)
  function handleSelect(v: number) {
    patchScreenTime(q.id, v)
    // Build the payload from a freshly-merged object (captured per click)
    // instead of relying on the debounced saveDraft's closure over
    // pre-click state — that was sending the PREVIOUS answer, not this one.
    const nextAnswers = { ...screentime, [q.id]: v }
    cancelPendingDraft()
    draftTimer.current = setTimeout(() => {
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx, stage: 'screentime', answers: nextAnswers }),
      }).catch((err) => console.error('[ScreenTimeScreen] autosave failed:', err))
    }, 100)
  }

  return (
    <>
      <QuestionShell
        stageIcon="📱"
        stageTitle="Gadget & Medsos"
        current={idx + 1}
        total={TOTAL}
        question={`${q.icon}  ${q.label}`}
        avatarMood={idx < 3 ? 'think' : 'happy'}
        avatarMessage={idx === 0 ? 'Saatnya cerita soal gadget & medsos 📱' : undefined}
      >
        <div className="grid gap-2.5">
          {q.options.map((opt) => {
            const selected = value === opt.value
            return (
              <motion.button
                key={opt.value}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(opt.value)}
                className={`flex items-center justify-between rounded-2xl border-2 bg-gradient-to-br p-4 text-left transition-all ${
                  selected
                    ? 'border-emerald-500 from-emerald-100 to-emerald-50 shadow-md ring-2 ring-emerald-500/30'
                    : 'border-black/5 from-white to-white hover:border-emerald-300 hover:shadow-sm dark:from-white/5 dark:border-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{opt.label}</span>
                </span>
                {selected && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                    ✓
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Navigation buttons — manual control */}
        <div className="mt-6 flex gap-3">
          {idx > 0 && (
            <Button variant="outline" size="lg" className="h-12 rounded-2xl" onClick={goPrev}>
              ← Kembali
            </Button>
          )}
          <Button
            size="lg"
            onClick={goNext}
            disabled={value === undefined || saving}
            className="h-12 flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-bold text-white shadow-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : isLast ? 'Selesai →' : 'Lanjut →'}
          </Button>
        </div>

        {/* Hint when no answer selected */}
        {value === undefined && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Pilih salah satu jawaban untuk melanjutkan
          </p>
        )}
      </QuestionShell>

      <Confetti show={showComplete} />
      <StageCompleteOverlay
        show={showComplete}
        title="Hebat!"
        subtitle="Bagian gadget & medsos selesai. Lanjut ke bagian dukungan ya 🤝"
        emoji="📱"
        onContinue={() => {
          setShowComplete(false)
          useAppStore.setState((s) => ({
            session: s.session ? { ...s.session, currentStage: 'mos', stageIndex: 0 } : s.session,
          }))
        }}
        continueLabel="Lanjut ke Dukungan"
      />
    </>
  )
}
