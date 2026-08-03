'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { DEMOGRAPHIC_FIELDS } from '@/lib/instruments'
import { QuestionShell } from '@/components/teenmind/question-shell'

const ENCOURAGE = [
  'Ayo mulai dari data diri ya 😊',
  'Mantap! Lanjut...',
  'Sedikit lagi...',
  'Kamu keren! Terus isi ya',
  'Hampir selesai data diri!',
]

export function DemographicsScreen() {
  const session = useAppStore((s) => s.session)
  const demographic = useAppStore((s) => s.demographic)
  const patchDemographic = useAppStore((s) => s.patchDemographic)
  const [idx, setIdx] = useState(Math.min(session?.stageIndex ?? 0, DEMOGRAPHIC_FIELDS.length - 1))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const total = DEMOGRAPHIC_FIELDS.length
  const field = DEMOGRAPHIC_FIELDS[idx]
  const currentVal = demographic?.[field.key] ?? ''

  function next() {
    if (!currentVal || (typeof currentVal === 'string' && !currentVal.trim())) {
      setError('Masih ada pertanyaan yang belum dijawab.')
      return
    }
    setError(null)
    // autosave index + partial demographic answers (true mid-stage persistence)
    const updatedDemo = { ...demographic, [field.key]: currentVal }
    fetch('/api/save', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageIndex: idx + 1, stage: 'demographics', answers: updatedDemo }),
    })
    if (idx + 1 < total) {
      setIdx(idx + 1)
    } else {
      // finalize stage
      setSaving(true)
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'demographics', answers: demographic ?? {} }),
      }).finally(() => {
        setSaving(false)
        useAppStore.setState((s) => ({
          session: s.session ? { ...s.session, currentStage: 'cesdr', stageIndex: 0 } : s.session,
        }))
      })
    }
  }

  function prev() {
    if (idx > 0) {
      setError(null)
      setIdx(idx - 1)
    }
  }

  return (
    <QuestionShell
      stageIcon="👤"
      stageTitle="Data Diri"
      current={idx + 1}
      total={total}
      question={`${field.icon}  ${field.label}`}
      avatarMood={idx === 0 ? 'happy' : 'encourage'}
      avatarMessage={ENCOURAGE[Math.min(idx, ENCOURAGE.length - 1)]}
    >
      {field.type === 'select' ? (
        <div className="grid gap-2.5">
          {field.options.map((opt) => {
            const selected = currentVal === opt.value
            return (
              <motion.button
                key={opt.value}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  patchDemographic(field.key, opt.value)
                  setError(null)
                }}
                className={`flex items-center justify-between rounded-2xl border-2 bg-gradient-to-br p-4 text-left transition-all ${
                  selected
                    ? 'border-sky-500 from-sky-100 to-sky-50 shadow-md ring-2 ring-sky-500/30'
                    : 'border-black/5 from-white to-white hover:border-sky-300 hover:shadow-sm'
                }`}
              >
                <span className="font-medium text-foreground">{opt.label}</span>
                {selected && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-white">
                    ✓
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      ) : (
        <Input
          value={currentVal}
          onChange={(e) => {
            patchDemographic(field.key, e.target.value)
            setError(null)
          }}
          placeholder={field.placeholder}
          inputMode={field.type === 'number' ? 'numeric' : 'text'}
          className="h-14 rounded-2xl border-2 bg-white text-lg font-medium shadow-sm focus-visible:ring-primary"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') next()
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
          <Button variant="outline" size="lg" className="h-12 rounded-2xl" onClick={prev}>
            ← Kembali
          </Button>
        )}
        <Button
          size="lg"
          onClick={next}
          disabled={saving || (!currentVal || (typeof currentVal === 'string' && !currentVal.trim()))}
          className="h-12 flex-1 rounded-2xl bg-gradient-to-r from-sky-500 to-teal-500 text-base font-bold text-white shadow-lg hover:from-sky-600 hover:to-teal-600 disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : idx + 1 < total ? 'Lanjut →' : 'Selesai, Lanjut ke CESD-R →'}
        </Button>
      </div>

      {/* Hint when no answer entered */}
      {(!currentVal || (typeof currentVal === 'string' && !currentVal.trim())) && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Isi jawaban untuk melanjutkan
        </p>
      )}
    </QuestionShell>
  )
}
