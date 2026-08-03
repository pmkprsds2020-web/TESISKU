'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StageId } from './instruments'

export type AppMode = 'welcome' | 'loading' | 'login' | 'respondent' | 'admin-login' | 'admin'

export type RespondentStage =
  | 'consent'
  | 'demographics'
  | 'cesdr'
  | 'psqi'
  | 'screentime'
  | 'mos'
  | 'bullying'
  | 'religiosity'
  | 'complete'

export type SessionData = {
  code: string
  school?: string | null
  status: string
  currentStage: RespondentStage
  stageIndex: number
  highRisk: boolean
  consentGiven: boolean
  respondentId: string
}

type State = {
  mode: AppMode
  session: SessionData | null
  // answers cache (also persisted server-side)
  demographic: Record<string, string> | null
  cesdr: Record<number, number>
  psqi: Record<string, string | number>
  screentime: Record<string, number>
  mos: Record<number, number>
  bullying: Record<number, number>
  religiosity: Record<number, number>
  // ui flags
  highRiskAcknowledged: boolean
}

type Actions = {
  setMode: (m: AppMode) => void
  setSession: (s: SessionData | null) => void
  setAnswers: <K extends 'demographic' | 'cesdr' | 'psqi' | 'screentime' | 'mos' | 'bullying' | 'religiosity'>(
    key: K,
    answers: State[K]
  ) => void
  patchAnswers: (key: 'cesdr' | 'mos' | 'bullying' | 'religiosity', id: number, value: number) => void
  patchDemographic: (key: string, value: string) => void
  patchScreenTime: (key: string, value: number) => void
  patchPsqi: (key: string, value: string | number) => void
  setHighRiskAcknowledged: (v: boolean) => void
  reset: () => void
  hydrateFromServer: (data: {
    currentStage: RespondentStage
    stageIndex: number
    highRisk: boolean
    consentGiven: boolean
    status: string
    answers: {
      demographic: Record<string, string> | null
      cesdr: Record<number, number> | null
      psqi: Record<string, string | number> | null
      screentime: Record<string, number> | null
      mos: Record<number, number> | null
      bullying: Record<number, number> | null
      religiosity: Record<number, number> | null
    }
  }) => void
}

const initialAnswers = {
  demographic: null,
  cesdr: {},
  psqi: {},
  screentime: {},
  mos: {},
  bullying: {},
  religiosity: {},
}

export const useAppStore = create<State & Actions>()(
  persist(
    (set) => ({
      mode: 'welcome',
      session: null,
      ...initialAnswers,
      highRiskAcknowledged: false,
      setMode: (mode) => set({ mode }),
      setSession: (session) => set({ session }),
      setAnswers: (key, answers) => set({ [key]: answers } as Partial<State>),
      patchAnswers: (key, id, value) =>
        set((s) => ({ [key]: { ...(s[key] as Record<number, number>), [id]: value } } as Partial<State>)),
      patchDemographic: (key, value) =>
        set((s) => ({ demographic: { ...(s.demographic ?? {}), [key]: value } })),
      patchScreenTime: (key, value) =>
        set((s) => ({ screentime: { ...(s.screentime ?? {}), [key]: value } })),
      patchPsqi: (key, value) =>
        set((s) => ({ psqi: { ...(s.psqi ?? {}), [key]: value } })),
      setHighRiskAcknowledged: (highRiskAcknowledged) => set({ highRiskAcknowledged }),
      reset: () => set({ mode: 'welcome', session: null, ...initialAnswers, highRiskAcknowledged: false }),
      hydrateFromServer: (data) =>
        set((s) => ({
          // Merge: server data takes precedence for completed stages,
          // but preserve local mid-stage progress when server has no data.
          demographic: data.answers.demographic ?? s.demographic ?? null,
          cesdr: { ...(s.cesdr ?? {}), ...(data.answers.cesdr ?? {}) },
          psqi: { ...(s.psqi ?? {}), ...(data.answers.psqi ?? {}) },
          screentime: { ...(s.screentime ?? {}), ...(data.answers.screentime ?? {}) },
          mos: { ...(s.mos ?? {}), ...(data.answers.mos ?? {}) },
          bullying: { ...(s.bullying ?? {}), ...(data.answers.bullying ?? {}) },
          religiosity: { ...(s.religiosity ?? {}), ...(data.answers.religiosity ?? {}) },
        })),
    }),
    {
      name: 'teenmind-store',
      partialize: (s) => ({
        mode: s.mode,
        session: s.session,
        demographic: s.demographic,
        cesdr: s.cesdr,
        psqi: s.psqi,
        screentime: s.screentime,
        mos: s.mos,
        bullying: s.bullying,
        religiosity: s.religiosity,
        highRiskAcknowledged: s.highRiskAcknowledged,
      }),
    }
  )
)

// Helper: compute global progress percent across stages
export const STAGE_ORDER: RespondentStage[] = [
  'consent',
  'demographics',
  'cesdr',
  'psqi',
  'screentime',
  'mos',
  'bullying',
  'religiosity',
  'complete',
]

export function computeProgress(stage: RespondentStage, stageIndex: number, stageTotal: number) {
  const stageIdx = STAGE_ORDER.indexOf(stage)
  if (stageIdx < 0) return 0
  const base = (stageIdx / (STAGE_ORDER.length - 1)) * 100
  const within = stageTotal > 0 ? (stageIndex / stageTotal) * (100 / (STAGE_ORDER.length - 1)) : 0
  return Math.min(100, Math.round(base + within))
}

export function stageLabel(stage: RespondentStage): { title: string; subtitle: string; icon: string; color: string } {
  const map: Record<RespondentStage, { title: string; subtitle: string; icon: string; color: string }> = {
    consent: { title: 'Persetujuan', subtitle: 'Lembar Assen', icon: '📋', color: 'violet' },
    demographics: { title: 'Data Diri', subtitle: 'Demografi', icon: '👤', color: 'sky' },
    cesdr: { title: 'Perasaanku', subtitle: 'CESD-R', icon: '💭', color: 'rose' },
    psqi: { title: 'Tidurku', subtitle: 'PSQI', icon: '😴', color: 'indigo' },
    screentime: { title: 'Gadget & Medsos', subtitle: 'Screen Time', icon: '📱', color: 'emerald' },
    mos: { title: 'Dukungan', subtitle: 'MOS-SSS', icon: '🤝', color: 'amber' },
    bullying: { title: 'Sekolahku', subtitle: 'Bullying', icon: '🏫', color: 'orange' },
    religiosity: { title: 'Ibadah', subtitle: 'Religiusitas', icon: '🕌', color: 'teal' },
    complete: { title: 'Selesai', subtitle: 'Terima kasih', icon: '🎉', color: 'emerald' },
  }
  return map[stage]
}
