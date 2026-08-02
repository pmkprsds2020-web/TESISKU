'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { CESDR_ITEMS, CESDR_OPTIONS, CESDR_HIGH_RISK_ITEM, CESDR_HIGH_RISK_THRESHOLD } from '@/lib/instruments'
import { QuestionShell } from '@/components/teenmind/question-shell'
import { RadioCardGroup } from '@/components/teenmind/radio-card-group'
import { HighRiskDialog } from '@/components/teenmind/high-risk-dialog'
import { StageCompleteOverlay } from '@/components/teenmind/stage-complete-overlay'
import { Confetti } from '@/components/teenmind/confetti'

const TOTAL = CESDR_ITEMS.length

export function CesdrScreen() {
  const session = useAppStore((s) => s.session)
  const cesdr = useAppStore((s) => s.cesdr)
  const patchAnswers = useAppStore((s) => s.patchAnswers)
  const setHighRiskAcknowledged = useAppStore((s) => s.setHighRiskAcknowledged)
  const highRiskAcknowledged = useAppStore((s) => s.highRiskAcknowledged)

  const [idx, setIdx] = useState(Math.min(session?.stageIndex ?? 0, CESDR_ITEMS.length - 1))
  const [showHighRisk, setShowHighRisk] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [saving, setSaving] = useState(false)

  const item = CESDR_ITEMS[idx]
  // Restore previously saved answer from store
  const value = item ? cesdr[item.id] : undefined

  // PERF (audit finding): previously, selecting an answer scheduled a save
  // via setTimeout(100ms), and clicking "Lanjut"/"Kembali" immediately
  // after fired ANOTHER save with the exact same answers — so every
  // question step sent two nearly-identical PATCH requests to the server.
  // We keep the short-delay draft save (so an answer isn't lost if the
  // respondent closes the tab before navigating), but cancel it whenever a
  // navigation save is about to send the same data anyway.
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelPendingDraft = useCallback(() => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current)
      draftTimer.current = null
    }
  }, [])

  // Save draft to server (without advancing)
  const saveDraft = useCallback(() => {
    fetch('/api/save', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageIndex: idx, stage: 'cesdr', answers: cesdr }),
    })
  }, [idx, cesdr])

  // Navigate to next question (only via button)
  const goNext = useCallback(() => {
    cancelPendingDraft()
    if (idx + 1 < TOTAL) {
      setIdx(idx + 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx + 1, stage: 'cesdr', answers: cesdr }),
      })
    } else {
      // Last question — submit stage
      setSaving(true)
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'cesdr', answers: cesdr }),
      }).finally(() => {
        setSaving(false)
        setShowComplete(true)
      })
    }
  }, [idx, cesdr, cancelPendingDraft])

  // Navigate to previous question
  const goPrev = useCallback(() => {
    cancelPendingDraft()
    if (idx > 0) {
      setIdx(idx - 1)
      fetch('/api/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIndex: idx - 1, stage: 'cesdr', answers: cesdr }),
      })
    }
  }, [idx, cesdr, cancelPendingDraft])

  // Select answer — saves draft, stays on same page (NO auto-advance)
  function handleSelect(v: number) {
    patchAnswers('cesdr', item.id, v)
    // Save draft shortly after selecting, unless the respondent navigates
    // first (goNext/goPrev cancel this and send fresh data themselves).
    cancelPendingDraft()
    draftTimer.current = setTimeout(() => saveDraft(), 100)

    // Check high-risk condition (item 18)
    if (item.id === CESDR_HIGH_RISK_ITEM && v >= CESDR_HIGH_RISK_THRESHOLD && !highRiskAcknowledged) {
      setTimeout(() => setShowHighRisk(true), 500)
    }
  }

  function handleHighRiskAck() {
    setShowHighRisk(false)
    setHighRiskAcknowledged(true)
  }

  function handleStageComplete() {
    setShowComplete(false)
    useAppStore.setState((s) => ({
      session: s.session ? { ...s.session, currentStage: 'psqi', stageIndex: 0 } : s.session,
    }))
  }

  if (!item) {
    return null
  }

  const isLast = idx + 1 === TOTAL

  return (
    <>
      <QuestionShell
        stageIcon="💭"
        stageTitle="Perasaanku (CESD-R)"
        current={idx + 1}
        total={TOTAL}
        question={`Dalam minggu terakhir, seberapa sering: "${item.text}"`}
        avatarMood={idx < 5 ? 'think' : idx < 15 ? 'calm' : 'encourage'}
        avatarMessage={
          idx === 0 ? 'Tidak ada jawaban benar/salah. Jawab sesuai perasaanmu 💙' :
          idx === TOTAL - 1 ? 'Sedikit lagi selesai!' :
          idx % 5 === 0 ? 'Kerja bagus, lanjutkan ya!' : undefined
        }
      >
        <RadioCardGroup
          options={CESDR_OPTIONS}
          value={value}
          onChange={handleSelect}
          columns={1}
        />

        {/* Navigation buttons — manual control */}
        <div className="mt-6 flex gap-3">
          {idx > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-2xl"
              onClick={goPrev}
            >
              ← Kembali
            </Button>
          )}
          <Button
            size="lg"
            onClick={goNext}
            disabled={value === undefined || saving}
            className="h-12 flex-1 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-base font-bold text-white shadow-lg hover:from-rose-600 hover:to-pink-600 disabled:opacity-50"
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

      <HighRiskDialog open={showHighRisk} onAcknowledge={handleHighRiskAck} />
      <Confetti show={showComplete} />
      <StageCompleteOverlay
        show={showComplete}
        title="Hebat!"
        subtitle="Bagian perasaan sudah selesai. Lanjut ke bagian tidur ya 😴"
        emoji="💭"
        onContinue={handleStageComplete}
        continueLabel="Lanjut ke Tidur"
      />
    </>
  )
}
