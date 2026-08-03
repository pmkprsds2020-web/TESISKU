'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { QuestionShell } from '@/components/teenmind/question-shell'
import { RadioCardGroup } from '@/components/teenmind/radio-card-group'
import { StageCompleteOverlay } from '@/components/teenmind/stage-complete-overlay'
import { Confetti } from '@/components/teenmind/confetti'
import {
  GBS_ITEMS, GBS_OPTIONS_1_2, GBS_OPTIONS_3_4,
  CLIMATE_ITEMS, CLIMATE_OPTIONS,
} from '@/lib/instruments'
import type { AvatarMood } from '@/components/teenmind/avatar'

// Combined items: GBS 1-4 + Climate 5-12
const ALL_ITEMS = [
  ...GBS_ITEMS.map(g => ({ id: g.id, text: g.text, icon: g.icon, section: 'GBS' as const })),
  ...CLIMATE_ITEMS.map(c => ({ id: c.id, text: c.text, icon: '🏫', section: 'Climate' as const })),
]

const TOTAL = ALL_ITEMS.length // 12

function getOptionsForItem(itemId: number) {
  if (itemId <= 2) return GBS_OPTIONS_1_2
  if (itemId <= 4) return GBS_OPTIONS_3_4
  return CLIMATE_OPTIONS
}

export function BullyingScreen() {
  const session = useAppStore((s) => s.session)
  const bullying = useAppStore((s) => s.bullying)
  const patchAnswers = useAppStore((s) => s.patchAnswers)
  const [idx, setIdx] = useState(Math.min(session?.stageIndex ?? 0, ALL_ITEMS.length - 1))
  const [showComplete, setShowComplete] = useState(false)
  const [saving, setSaving] = useState(false)

  const item = ALL_ITEMS[idx]
  const value = item ? bullying[item.id] : undefined

  // Navigate next (only via button)
  const goNext = useCallback(() => {
    if (idx + 1 < TOTAL) {
      setIdx(idx + 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx + 1, stage: 'bullying', answers: bullying }),
      })
    } else {
      setSaving(true)
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'bullying', answers: bullying }),
      }).finally(() => {
        setSaving(false)
        setShowComplete(true)
      })
    }
  }, [idx, bullying, TOTAL])

  // Navigate prev (preserves answers)
  const goPrev = useCallback(() => {
    if (idx > 0) {
      setIdx(idx - 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx - 1, stage: 'bullying', answers: bullying }),
      })
    }
  }, [idx, bullying])

  const mood: AvatarMood = idx === 0 ? 'happy' : idx === TOTAL - 1 ? 'encourage' : 'calm'

  if (!item) {
    return null
  }

  const options = getOptionsForItem(item.id)
  const optWithColor = options.map(o => ({
    ...o,
    color: o.value === 0
      ? 'from-emerald-100 to-emerald-50 border-emerald-300 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-100'
      : o.value === 1
      ? 'from-amber-100 to-amber-50 border-amber-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-100'
      : o.value === 2
      ? 'from-orange-100 to-orange-50 border-orange-300 data-[selected=true]:border-orange-500 data-[selected=true]:bg-orange-100'
      : 'from-rose-100 to-rose-50 border-rose-300 data-[selected=true]:border-rose-500 data-[selected=true]:bg-rose-100',
  }))

  const isGBS = item.section === 'GBS'
  const isLast = idx + 1 === TOTAL

  // Handle selection — save draft, stay on same page (NO auto-advance)
  function handleSelect(v: number) {
    patchAnswers('bullying', item.id, v)
    // Build the payload from a freshly-merged object instead of relying on
    // component state / a debounced closure — avoids sending stale data
    // that's missing the answer the user just picked.
    const nextAnswers = { ...bullying, [item.id]: v }
    fetch('/api/save', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageIndex: idx, stage: 'bullying', answers: nextAnswers }),
    }).catch((err) => console.error('[BullyingScreen] autosave failed:', err))
  }

  return (
    <>
      <QuestionShell
        stageIcon="🏫"
        stageTitle="Sekolahku (GBS + Iklim Sekolah)"
        current={idx + 1}
        total={TOTAL}
        question={item.text}
        avatarMood={mood}
        avatarMessage={
          idx === 0 ? 'Bagian A: Pengalaman Perundungan 🏫' :
          idx === 4 ? 'Bagian B: Iklim Sekolah 🌟' :
          idx === TOTAL - 1 ? 'Sedikit lagi!' :
          undefined
        }
      >
        {/* Section indicator */}
        {idx === 0 || idx === 4 ? (
          <div className="mb-3 rounded-xl bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 dark:bg-orange-950/20 dark:text-orange-300">
            {idx === 0 ? '📋 Bagian A — Pengalaman Perundungan (GBS)' : '🌟 Bagian B — Iklim Sekolah'}
          </div>
        ) : null}

        <RadioCardGroup
          options={optWithColor}
          value={value}
          onChange={handleSelect}
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
            className="h-12 flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-base font-bold text-white shadow-lg disabled:opacity-50"
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
        subtitle="Bagian pengalaman sekolah selesai. Lanjut ke bagian terakhir ya 🕌"
        emoji="🏫"
        onContinue={() => {
          setShowComplete(false)
          useAppStore.setState((s) => ({
            session: s.session
              ? {
                  ...s.session,
                  currentStage: 'religiosity',
                  stageIndex: 0,
                  status: s.session.status,
                }
              : s.session,
          }))
        }}
        continueLabel="Lanjut ke Ibadah"
      />
    </>
  )
}
