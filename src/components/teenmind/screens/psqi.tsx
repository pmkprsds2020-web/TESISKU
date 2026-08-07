'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { PSQI_QUESTIONS } from '@/lib/instruments'
import { QuestionShell } from '@/components/teenmind/question-shell'
import { RadioCardGroup } from '@/components/teenmind/radio-card-group'
import { StageCompleteOverlay } from '@/components/teenmind/stage-complete-overlay'
import { Confetti } from '@/components/teenmind/confetti'

const TOTAL = PSQI_QUESTIONS.length

export function PsqiScreen() {
  const session = useAppStore((s) => s.session)
  const psqi = useAppStore((s) => s.psqi)
  const patchPsqi = useAppStore((s) => s.patchPsqi)
  const [idx, setIdx] = useState(Math.min(session?.stageIndex ?? 0, PSQI_QUESTIONS.length - 1))
  const [error, setError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [saving, setSaving] = useState(false)

  const q = PSQI_QUESTIONS[idx]
  const value = q ? psqi[q.id] : undefined

  const isAnswered = value !== undefined && value !== '' && !(typeof value === 'number' && Number.isNaN(value))

  function next() {
    if (!isAnswered) {
      setError('Masih ada pertanyaan yang belum dijawab.')
      return
    }
    setError(null)
    // autosave index + partial PSQI answers
    const updatedPsqi = { ...psqi, [q.id]: value }
    fetch('/api/save', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageIndex: idx + 1, stage: 'psqi', answers: updatedPsqi }),
    })
    if (idx + 1 < TOTAL) {
      setIdx(idx + 1)
    } else {
      setSaving(true)
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'psqi', answers: psqi }),
      }).finally(() => {
        setSaving(false)
        setShowComplete(true)
      })
    }
  }

  if (!q) {
    return null
  }

  return (
    <>
      <QuestionShell
        stageIcon="😴"
        stageTitle="Tidurku (PSQI)"
        current={idx + 1}
        total={TOTAL}
        question={`${q.icon}  ${q.label}`}
        avatarMood={idx < 3 ? 'sleep' : 'calm'}
        avatarMessage={idx === 0 ? 'Ceritakan kebiasaan tidurmu ya 🌙' : undefined}
      >
        {q.type === 'time' && (
          <div className="flex justify-center py-2">
            <input
              type="time"
              value={String(value ?? '')}
              onChange={(e) => {
                patchPsqi(q.id, e.target.value)
                setError(null)
              }}
              className="h-16 w-40 rounded-2xl border-2 border-black/10 bg-white text-center text-3xl font-bold text-foreground shadow-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
        )}

        {q.type === 'number' && (
          <div className="flex items-center justify-center gap-3 py-2">
            <Input
              type="number"
              value={value === undefined ? '' : String(value)}
              onChange={(e) => {
                patchPsqi(q.id, e.target.value === '' ? 0 : Number(e.target.value))
                setError(null)
              }}
              min={q.min}
              max={q.max}
              inputMode="numeric"
              className="h-16 w-32 rounded-2xl border-2 bg-white text-center text-2xl font-bold shadow-sm focus-visible:ring-primary"
            />
            <span className="text-lg font-semibold text-muted-foreground">{q.unit}</span>
          </div>
        )}

        {q.type === 'likert' && (
          <RadioCardGroup
            options={q.options.map((o) => ({ ...o, color: 'from-indigo-100 to-violet-50 border-indigo-200 data-[selected=true]:border-indigo-500 data-[selected=true]:bg-indigo-100' }))}
            value={value as number | undefined}
            onChange={(v) => {
              patchPsqi(q.id, v as number)
              setError(null)
            }}
          />
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-sm font-medium text-rose-600"
          >
            {error}
          </motion.p>
        )}

        <div className="mt-6 flex gap-3">
          {idx > 0 && (
            <Button variant="outline" size="lg" className="h-12 rounded-2xl" onClick={() => { setError(null); setIdx(idx - 1) }}>
              ← Kembali
            </Button>
          )}
          <Button
            size="lg"
            onClick={next}
            disabled={saving}
            className="h-12 flex-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-base font-bold text-white shadow-lg hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : idx + 1 < TOTAL ? 'Lanjut →' : 'Selesai →'}
          </Button>
        </div>
      </QuestionShell>

      <Confetti show={showComplete} />
      <StageCompleteOverlay
        show={showComplete}
        title="Hebat!"
        subtitle="Bagian tidur selesai. Lanjut ke bagian gadget & medsos ya 📱"
        emoji="😴"
        onContinue={() => {
          setShowComplete(false)
          useAppStore.setState((s) => ({
            session: s.session ? { ...s.session, currentStage: 'screentime', stageIndex: 0 } : s.session,
          }))
        }}
        continueLabel="Lanjut ke Gadget"
      />
    </>
  )
}
