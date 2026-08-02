'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, GitBranch, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'

type MediationData = {
  predictor: string
  mediator: string
  outcome: string
  predictorLabel: string
  mediatorLabel: string
  outcomeLabel: string
  n: number
  steps: {
    step1: { name: string; c: number; se: number; t: number; p: number; rSquared: number; significant: boolean }
    step2: { name: string; a: number; se: number; t: number; p: number; rSquared: number; significant: boolean }
    step3: {
      name: string
      cPrime: number; b: number; seC: number; seB: number
      tC: number; tB: number; pC: number; pB: number
      cSignificant: boolean; bSignificant: boolean
    }
  }
  indirectEffect: number
  proportionMediated: number
  sobelTest: { z: number; p: number; significant: boolean }
  mediationType: string
  description: string
}

const VAR_OPTIONS = [
  { value: 'bullying', label: 'Bullying' },
  { value: 'psqi', label: 'PSQI (Tidur)' },
  { value: 'mos', label: 'MOS (Dukungan)' },
  { value: 'religiosity', label: 'Religiusitas' },
  { value: 'cesdr', label: 'CESD-R (Depresi)' },
]

export function MediationPanel() {
  const [predictor, setPredictor] = useState('bullying')
  const [mediator, setMediator] = useState('mos')
  const [outcome, setOutcome] = useState('cesdr')
  const [data, setData] = useState<MediationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (predictor === mediator || mediator === outcome || predictor === outcome) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/mediation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictor, mediator, outcome }),
        })
        const d = await res.json()
        if (!cancelled) {
          if (d.error) setError(d.error)
          else setData(d)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [predictor, mediator, outcome])

  function pFormat(p: number) {
    return p < 0.001 ? '<0.001' : p.toFixed(4)
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <GitBranch className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Mediasi (Baron & Kenny)</h3>
            <p className="text-xs text-white/80">Uji peran mediator · Sobel test · 4 langkah</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {/* Variable selectors */}
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Prediktor (X)</label>
            <select
              value={predictor}
              onChange={(e) => setPredictor(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-white/5"
            >
              {VAR_OPTIONS.filter(o => o.value !== mediator && o.value !== outcome).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Mediator (M)</label>
            <select
              value={mediator}
              onChange={(e) => setMediator(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-white/5"
            >
              {VAR_OPTIONS.filter(o => o.value !== predictor && o.value !== outcome).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Outcome (Y)</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-white/5"
            >
              {VAR_OPTIONS.filter(o => o.value !== predictor && o.value !== mediator).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/20 dark:text-rose-300">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : data ? (
          <div className="space-y-5">
            {/* Path diagram */}
            <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-6 ring-1 ring-black/5 dark:ring-white/5">
              <div className="flex items-center justify-between">
                {/* X */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg">
                    <span className="text-xs font-bold">X</span>
                  </div>
                  <p className="text-[10px] font-medium text-foreground">{data.predictorLabel}</p>
                </div>

                {/* Arrow X→M with coefficient a */}
                <div className="flex flex-1 flex-col items-center px-2">
                  <div className="relative w-full">
                    <svg width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <line x1="0" y1="15" x2="90" y2="15" stroke={data.steps.step2.significant ? '#fb7185' : '#cbd5e1'} strokeWidth="2" />
                      <polygon points="90,15 85,10 85,20" fill={data.steps.step2.significant ? '#fb7185' : '#cbd5e1'} />
                    </svg>
                  </div>
                  <Badge variant={data.steps.step2.significant ? 'destructive' : 'secondary'} className="text-[9px]">
                    a = {data.steps.step2.a}
                    {data.steps.step2.significant && '*'}
                  </Badge>
                  <p className="text-[9px] text-muted-foreground">p = {pFormat(data.steps.step2.p)}</p>
                </div>

                {/* M */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                    <span className="text-xs font-bold">M</span>
                  </div>
                  <p className="text-[10px] font-medium text-foreground">{data.mediatorLabel}</p>
                </div>

                {/* Arrow M→Y with coefficient b */}
                <div className="flex flex-1 flex-col items-center px-2">
                  <div className="relative w-full">
                    <svg width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <line x1="0" y1="15" x2="90" y2="15" stroke={data.steps.step3.bSignificant ? '#fb7185' : '#cbd5e1'} strokeWidth="2" />
                      <polygon points="90,15 85,10 85,20" fill={data.steps.step3.bSignificant ? '#fb7185' : '#cbd5e1'} />
                    </svg>
                  </div>
                  <Badge variant={data.steps.step3.bSignificant ? 'destructive' : 'secondary'} className="text-[9px]">
                    b = {data.steps.step3.b}
                    {data.steps.step3.bSignificant && '*'}
                  </Badge>
                  <p className="text-[9px] text-muted-foreground">p = {pFormat(data.steps.step3.pB)}</p>
                </div>

                {/* Y */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg">
                    <span className="text-xs font-bold">Y</span>
                  </div>
                  <p className="text-[10px] font-medium text-foreground">{data.outcomeLabel}</p>
                </div>
              </div>

              {/* Direct path c' */}
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[10px] text-muted-foreground">Path langsung (c'):</span>
                <Badge variant={data.steps.step3.cSignificant ? 'destructive' : 'secondary'} className="text-[9px]">
                  c' = {data.steps.step3.cPrime}
                  {data.steps.step3.cSignificant && '*'}
                </Badge>
                <span className="text-[9px] text-muted-foreground">(p = {pFormat(data.steps.step3.pC)})</span>
              </div>
            </div>

            {/* Mediation type */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${
                data.mediationType.includes('Penuh')
                  ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900'
                  : data.mediationType.includes('Parsial')
                  ? 'bg-amber-50 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900'
                  : 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  data.mediationType.includes('Penuh')
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    : data.mediationType.includes('Parsial')
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {data.mediationType.includes('Tidak') ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-bold text-foreground">{data.mediationType}</h5>
                  <p className="mt-1 text-xs text-foreground/80">{data.description}</p>
                </div>
              </div>
            </motion.div>

            {/* Sobel test + indirect effect */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 text-center ring-1 ring-violet-100 dark:from-violet-950/20 dark:to-fuchsia-950/20 dark:ring-violet-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Efek Tidak Langsung</p>
                <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{data.indirectEffect}</p>
                <p className="text-[10px] text-muted-foreground">a × b</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 p-3 text-center ring-1 ring-teal-100 dark:from-teal-950/20 dark:to-emerald-950/20 dark:ring-teal-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Sobel z</p>
                <p className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">{data.sobelTest.z}</p>
                <p className="text-[10px] text-muted-foreground">p = {pFormat(data.sobelTest.p)}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-center ring-1 ring-amber-100 dark:from-amber-950/20 dark:to-orange-950/20 dark:ring-amber-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">% Mediasi</p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{Math.round(data.proportionMediated * 100)}%</p>
                <p className="text-[10px] text-muted-foreground">dari efek total</p>
              </div>
            </div>

            {/* 4-step table */}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Langkah</th>
                    <th className="px-2 py-2 text-center font-semibold">Koefisien</th>
                    <th className="px-2 py-2 text-center font-semibold">SE</th>
                    <th className="px-2 py-2 text-center font-semibold">t</th>
                    <th className="px-2 py-2 text-center font-semibold">p</th>
                    <th className="px-2 py-2 text-center font-semibold">Sig.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-3 text-xs text-foreground">{data.steps.step1.name}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs font-bold">c = {data.steps.step1.c}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{data.steps.step1.se}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{data.steps.step1.t}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs">{data.steps.step1.significant ? <span className="font-bold text-rose-600">{pFormat(data.steps.step1.p)}</span> : pFormat(data.steps.step1.p)}</td>
                    <td className="px-2 py-2 text-center">{data.steps.step1.significant ? <Badge variant="destructive" className="text-[9px]">Ya</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-3 text-xs text-foreground">{data.steps.step2.name}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs font-bold">a = {data.steps.step2.a}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{data.steps.step2.se}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{data.steps.step2.t}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs">{data.steps.step2.significant ? <span className="font-bold text-rose-600">{pFormat(data.steps.step2.p)}</span> : pFormat(data.steps.step2.p)}</td>
                    <td className="px-2 py-2 text-center">{data.steps.step2.significant ? <Badge variant="destructive" className="text-[9px]">Ya</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-3 text-xs text-foreground">{data.steps.step3.name}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs font-bold">
                      c' = {data.steps.step3.cPrime}
                      <br />b = {data.steps.step3.b}
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                      {data.steps.step3.seC}
                      <br />{data.steps.step3.seB}
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                      {data.steps.step3.tC}
                      <br />{data.steps.step3.tB}
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-xs">
                      {data.steps.step3.cSignificant ? <span className="font-bold text-rose-600">{pFormat(data.steps.step3.pC)}</span> : pFormat(data.steps.step3.pC)}
                      <br />{data.steps.step3.bSignificant ? <span className="font-bold text-rose-600">{pFormat(data.steps.step3.pB)}</span> : pFormat(data.steps.step3.pB)}
                    </td>
                    <td className="px-2 py-2 text-center text-xs">
                      {data.steps.step3.cSignificant ? '✓' : '—'}
                      <br />{data.steps.step3.bSignificant ? '✓' : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Interpretation */}
            <div className="rounded-xl bg-amber-50/50 p-3 text-xs text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-900/30">
              <strong className="flex items-center gap-1"><GitBranch className="h-3.5 w-3.5" /> Interpretasi:</strong>
              <p className="mt-1 leading-relaxed">
                Model: <strong>{data.predictorLabel}</strong> → <strong>{data.mediatorLabel}</strong> → <strong>{data.outcomeLabel}</strong>.
                {data.mediationType.includes('Penuh') && ' Mediasi penuh: mediator sepenuhnya menjelaskan hubungan X→Y (c\' tidak signifikan).'}
                {data.mediationType.includes('Parsial') && ' Mediasi parsial: mediator menjelaskan sebagian hubungan X→Y (c\' masih signifikan tapi lebih kecil dari c).'}
                {data.mediationType.includes('Tidak') && ' Tidak ada mediasi signifikan: mediator tidak menjelaskan hubungan X→Y.'}
                {' '}Sobel test: z = {data.sobelTest.z}, p = {pFormat(data.sobelTest.p)}.
                {' '}Proporsi mediasi: {Math.round(data.proportionMediated * 100)}% dari efek total.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
