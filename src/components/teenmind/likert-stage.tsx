'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { QuestionShell } from '@/components/teenmind/question-shell'
import { RadioCardGroup } from '@/components/teenmind/radio-card-group'
import { StageCompleteOverlay } from '@/components/teenmind/stage-complete-overlay'
import { Confetti } from '@/components/teenmind/confetti'
import type { AvatarMood } from '@/components/teenmind/avatar'
import type { RespondentStage } from '@/lib/store'

type Item = { id: number; text: string; icon?: string }
type Option = { value: number; label: string; emoji?: string; description?: string; color: string }

export function LikertStage({
  stageKey,
  stageIcon,
  stageTitle,
  nextStage,
  nextStageLabel,
  items,
  options,
  patchFn,
  answers,
  completeEmoji,
  completeTitle = 'Hebat!',
  completeSubtitle,
  buttonGradient = 'from-sky-500 to-teal-500',
  avatarMoods,
  itemPrefix,
  autoAdvance = false,
}: {
  stageKey: 'cesdr' | 'mos' | 'bullying' | 'religiosity'
  stageIcon: string
  stageTitle: string
  nextStage: RespondentStage
  nextStageLabel: string
  items: Item[]
  options: Option[]
  patchFn: (id: number, value: number) => void
  answers: Record<number, number>
  completeEmoji: string
  completeTitle?: string
  completeSubtitle: string
  buttonGradient?: string
  avatarMoods?: AvatarMood[]
  itemPrefix?: (item: Item) => string
  autoAdvance?: boolean
}) {
  const session = useAppStore((s) => s.session)
  const [idx, setIdx] = useState(Math.min(session?.stageIndex ?? 0, items.length - 1))
  const [showComplete, setShowComplete] = useState(false)
  const [saving, setSaving] = useState(false)

  const TOTAL = items.length
  const item = items[idx]
  const value = item ? answers[item.id] : undefined

  // Navigate to next (only via button)
  const goNext = useCallback(() => {
    if (idx + 1 < TOTAL) {
      setIdx(idx + 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx + 1, stage: stageKey, answers }),
      })
    } else {
      // Last question — submit stage
      setSaving(true)
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: stageKey, answers }),
      }).finally(() => {
        setSaving(false)
        setShowComplete(true)
      })
    }
  }, [idx, answers, stageKey, TOTAL])

  // Navigate to previous (preserves answers)
  const goPrev = useCallback(() => {
    if (idx > 0) {
      setIdx(idx - 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx - 1, stage: stageKey, answers }),
      })
    }
  }, [idx, answers, stageKey])

  const mood: AvatarMood =
    avatarMoods
      ? avatarMoods[Math.min(idx, avatarMoods.length - 1)]
      : idx === 0 ? 'happy' : idx === TOTAL - 1 ? 'encourage' : 'calm'

  if (!item) {
    return null
  }

  const isLast = idx + 1 === TOTAL

  // Handle selection — save draft, stay on same page (NO auto-advance)
  function handleSelect(v: number) {
    patchFn(item.id, v)
    // Build the payload from a freshly-merged object instead of relying on
    // a delayed closure — avoids sending stale data missing this answer.
    const nextAnswers = { ...answers, [item.id]: v }
    fetch('/api/save', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageIndex: idx, stage: stageKey, answers: nextAnswers }),
    }).catch((err) => console.error(`[LikertStage:${stageKey}] autosave failed:`, err))
  }

  return (
    <>
      <QuestionShell
        stageIcon={stageIcon}
        stageTitle={stageTitle}
        current={idx + 1}
        total={TOTAL}
        question={itemPrefix ? itemPrefix(item) : item.text}
        avatarMood={mood}
        avatarMessage={
          idx === 0 ? 'Ayo mulai bagian ini 😊' :
          idx === TOTAL - 1 ? 'Sedikit lagi!' :
          idx % 3 === 0 ? 'Kerja bagus, lanjut!' : undefined
        }
      >
        <RadioCardGroup
          options={options}
          value={value}
          onChange={handleSelect}
          columns={1}
        />

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
            className={`h-12 flex-1 rounded-2xl bg-gradient-to-r ${buttonGradient} text-base font-bold text-white shadow-lg disabled:opacity-50`}
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
        title={completeTitle}
        subtitle={completeSubtitle}
        emoji={completeEmoji}
        onContinue={() => {
          setShowComplete(false)
          useAppStore.setState((s) => ({
            session: s.session
              ? {
                  ...s.session,
                  currentStage: nextStage,
                  stageIndex: 0,
                  status: nextStage === 'complete' ? 'completed' : s.session.status,
                }
              : s.session,
          }))
        }}
        continueLabel={nextStageLabel}
      />
    </>
  )
}
