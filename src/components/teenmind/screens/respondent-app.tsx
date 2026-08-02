'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, computeProgress, stageLabel, STAGE_ORDER } from '@/lib/store'
import { ProgressBar } from '@/components/teenmind/progress-bar'
import { ConsentScreen } from './consent'
import { DemographicsScreen } from './demographics'
import { CesdrScreen } from './cesdr'
import { PsqiScreen } from './psqi'
import { ScreenTimeScreen } from './screentime'
import { MosScreen } from './mos'
import { BullyingScreen } from './bullying'
import { ReligiosityScreen } from './religiosity'
import { CompleteScreen } from './complete'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function RespondentApp() {
  const session = useAppStore((s) => s.session)
  const reset = useAppStore((s) => s.reset)

  const stage = session?.currentStage ?? 'consent'
  const stageIndex = session?.stageIndex ?? 0

  // compute stage totals for progress (sesuai lampiran borang penelitian)
  const stageTotals: Record<string, number> = useMemo(
    () => ({
      consent: 1,
      demographics: 13, // 9 demografi + 4 riwayat kesehatan
      cesdr: 20,
      psqi: 7,
      screentime: 6,
      mos: 10,
      bullying: 12, // 4 GBS + 8 School Climate
      religiosity: 8,
      complete: 1,
    }),
    []
  )

  const info = stageLabel(stage)
  const percent = computeProgress(stage, stageIndex, stageTotals[stage] ?? 1)

  // estimated minutes left based on remaining stages
  const stageMinutes: Record<string, number> = {
    consent: 2, demographics: 4, cesdr: 5, psqi: 4, screentime: 4, mos: 3, bullying: 3, religiosity: 3, complete: 0,
  }
  const remainingStages = STAGE_ORDER.slice(STAGE_ORDER.indexOf(stage))
  const minutesLeft = Math.round(
    remainingStages.reduce((acc, s) => acc + (stageMinutes[s] ?? 0), 0) *
      (1 - (stageIndex / Math.max(1, stageTotals[stage] ?? 1)))
  )

  async function handleLogout() {
    await fetch('/api/progress', { method: 'DELETE' })
    reset()
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-mesh">
      {/* Sticky progress header */}
      <header className="sticky top-0 z-30 glass border-b border-black/5">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-lg">{info.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{info.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{info.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-black/5">
                <span className="text-primary font-mono">{session?.code}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={handleLogout}
                title="Keluar"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          </div>
          <ProgressBar
            percent={percent}
            estimatedMinutesLeft={minutesLeft}
            stageLabel={`Bagian ${STAGE_ORDER.indexOf(stage) + 1}/${STAGE_ORDER.length}`}
          />
        </div>
      </header>

      {/* Stage content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {stage === 'consent' && <ConsentScreen />}
            {stage === 'demographics' && <DemographicsScreen />}
            {stage === 'cesdr' && <CesdrScreen />}
            {stage === 'psqi' && <PsqiScreen />}
            {stage === 'screentime' && <ScreenTimeScreen />}
            {stage === 'mos' && <MosScreen />}
            {stage === 'bullying' && <BullyingScreen />}
            {stage === 'religiosity' && <ReligiosityScreen />}
            {stage === 'complete' && <CompleteScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-black/5 bg-white/60 py-3 text-center backdrop-blur">
        <p className="text-[11px] text-muted-foreground">
          🔒 Jawaban tersimpan otomatis · Dapat dilanjutkan kapan saja
        </p>
      </footer>
    </div>
  )
}
