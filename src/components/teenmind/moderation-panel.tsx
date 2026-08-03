'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Loader2, GitMerge, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react'

type Coefficient = {
  name: string
  beta: number
  se: number
  t: number
  p: number
  significant?: boolean
}

type SimpleSlope = {
  level: string
  w: number
  slope: number
  se: number
  t: number
  p: number
  significant: boolean
}

type ModerationData = {
  predictor: string
  moderator: string
  outcome: string
  predictorLabel: string
  moderatorLabel: string
  outcomeLabel: string
  n: number
  coefficients: Coefficient[]
  modelFit: {
    rSquared: number
    r2WithoutInteraction: number
    deltaR2: number
    fDelta: number
    pDelta: number
    fStat: number
    fP: number
  }
  simpleSlopes: SimpleSlope[]
  interactionPlot: { x: number; "W Rendah": number; "W Mean": number; "W Tinggi": number }[]
  hasInteraction: boolean
  description: string
}

const VAR_OPTIONS = [
  { value: 'bullying', label: 'Bullying' },
  { value: 'psqi', label: 'PSQI (Tidur)' },
  { value: 'mos', label: 'MOS (Dukungan)' },
  { value: 'religiosity', label: 'Religiusitas' },
  { value: 'cesdr', label: 'CESD-R (Depresi)' },
]

function pFormat(p: number) {
  return p < 0.001 ? '<0.001' : p.toFixed(4)
}

export function ModerationPanel() {
  const [predictor, setPredictor] = useState('bullying')
  const [moderator, setModerator] = useState('religiosity')
  const [outcome, setOutcome] = useState('cesdr')
  const [data, setData] = useState<ModerationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (predictor === moderator || moderator === outcome || predictor === outcome) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/moderation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictor, moderator, outcome }),
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
  }, [predictor, moderator, outcome])

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <GitMerge className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Moderasi</h3>
            <p className="text-xs text-white/80">Efek interaksi · Simple slopes · ΔR²</p>
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
              {VAR_OPTIONS.filter(o => o.value !== moderator && o.value !== outcome).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Moderator (W)</label>
            <select
              value={moderator}
              onChange={(e) => setModerator(e.target.value)}
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
              {VAR_OPTIONS.filter(o => o.value !== predictor && o.value !== moderator).map(opt => (
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
            {/* Model fit */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 p-3 text-center ring-1 ring-purple-100 dark:from-purple-950/20 dark:to-violet-950/20 dark:ring-purple-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">R² (full)</p>
                <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{data.modelFit.rSquared}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 p-3 text-center ring-1 ring-indigo-100 dark:from-indigo-950/20 dark:to-blue-950/20 dark:ring-indigo-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">ΔR² (interaksi)</p>
                <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{data.modelFit.deltaR2}</p>
                <p className="text-[10px] text-muted-foreground">p = {pFormat(data.modelFit.pDelta)}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 text-center ring-1 ring-violet-100 dark:from-violet-950/20 dark:to-fuchsia-950/20 dark:ring-violet-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">R² tanpa interaksi</p>
                <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{data.modelFit.r2WithoutInteraction}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-center ring-1 ring-amber-100 dark:from-amber-950/20 dark:to-orange-950/20 dark:ring-amber-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">N</p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{data.n}</p>
              </div>
            </div>

            {/* Interaction significance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${
                data.hasInteraction
                  ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900'
                  : 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  data.hasInteraction
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {data.hasInteraction ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">
                      {data.hasInteraction ? "Efek Moderasi Signifikan" : "Tidak Ada Efek Moderasi"}
                    </h5>
                    <Badge variant={data.hasInteraction ? 'destructive' : 'default'} className="text-[10px]">
                      p = {pFormat(data.coefficients[3].p)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">{data.description}</p>
                </div>
              </div>
            </motion.div>

            {/* Interaction plot */}
            <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Plot Interaksi (Simple Slopes)
                </h4>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.interactionPlot} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[-1, 1]}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v === -1 ? '-1 SD' : v === 0 ? 'Mean' : v === 1 ? '+1 SD' : ''}
                      label={{ value: data.predictorLabel, position: 'insideBottom', offset: -2, fontSize: 10, fill: 'oklch(0.5 0.02 250)' }}
                    />
                    <YAxis tick={{ fontSize: 10 }} label={{ value: data.outcomeLabel, angle: -90, position: 'insideLeft', fontSize: 10, fill: 'oklch(0.5 0.02 250)' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="W Rendah" stroke="#fb7185" strokeWidth={2.5} dot={{ r: 3 }} name={`${data.moderatorLabel} Rendah (-1SD)`} />
                    <Line type="monotone" dataKey="W Mean" stroke="#a5b4fc" strokeWidth={2.5} dot={{ r: 3 }} name={`${data.moderatorLabel} Mean`} />
                    <Line type="monotone" dataKey="W Tinggi" stroke="#86efac" strokeWidth={2.5} dot={{ r: 3 }} name={`${data.moderatorLabel} Tinggi (+1SD)`} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Simple slopes */}
            <div className="overflow-x-auto scrollbar-thin">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Simple Slopes (Efek X pada Y per Level W)</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Level Moderator</th>
                    <th className="px-2 py-2 text-center font-semibold">Slope</th>
                    <th className="px-2 py-2 text-center font-semibold">SE</th>
                    <th className="px-2 py-2 text-center font-semibold">t</th>
                    <th className="px-2 py-2 text-center font-semibold">p</th>
                    <th className="px-2 py-2 text-center font-semibold">Sig.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.simpleSlopes.map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs font-medium text-foreground">{s.level}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs font-bold text-foreground">{s.slope}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{s.se}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{s.t}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs">
                        <span className={s.significant ? 'font-bold text-rose-600' : 'text-muted-foreground'}>
                          {pFormat(s.p)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {s.significant ? <Badge variant="destructive" className="text-[9px]">Ya</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Full coefficients table */}
            <div className="overflow-x-auto scrollbar-thin">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Koefisien Regresi Moderasi</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Prediktor</th>
                    <th className="px-2 py-2 text-center font-semibold">β</th>
                    <th className="px-2 py-2 text-center font-semibold">SE</th>
                    <th className="px-2 py-2 text-center font-semibold">t</th>
                    <th className="px-2 py-2 text-center font-semibold">p</th>
                    <th className="px-2 py-2 text-center font-semibold">Sig.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coefficients.map((c, i) => (
                    <tr key={i} className={`border-b last:border-0 ${c.name.includes('Interaksi') ? 'bg-purple-50/30 dark:bg-purple-950/10' : ''}`}>
                      <td className="py-2 pr-3 text-xs font-medium text-foreground">{c.name}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs font-bold text-foreground">{c.beta}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{c.se}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{c.t}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs">
                        <span className={c.significant ? 'font-bold text-rose-600' : 'text-muted-foreground'}>
                          {pFormat(c.p)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {c.significant ? <Badge variant="destructive" className="text-[9px]">Ya</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Interpretation */}
            <div className="rounded-xl bg-purple-50/50 p-3 text-xs text-purple-800 ring-1 ring-purple-100 dark:bg-purple-950/20 dark:text-purple-300 dark:ring-purple-900/30">
              <strong className="flex items-center gap-1"><GitMerge className="h-3.5 w-3.5" /> Interpretasi:</strong>
              <p className="mt-1 leading-relaxed">
                Model: <strong>{data.predictorLabel}</strong> → <strong>{data.outcomeLabel}</strong>, dimoderasi oleh <strong>{data.moderatorLabel}</strong>.
                {data.hasInteraction
                  ? ` Interaksi signifikan (β₃ = ${data.coefficients[3].beta}, p = ${pFormat(data.coefficients[3].p)}). ${data.moderatorLabel} mempengaruhi kekuatan hubungan ${data.predictorLabel} → ${data.outcomeLabel}. ΔR² = ${data.modelFit.deltaR2} menunjukkan kontribusi unik interaksi.`
                  : ` Interaksi tidak signifikan (β₃ = ${data.coefficients[3].beta}, p = ${pFormat(data.coefficients[3].p)}). ${data.moderatorLabel} tidak memoderasi hubungan ${data.predictorLabel} → ${data.outcomeLabel}.`
                }
                {' '}Periksa plot interaksi: garis yang tidak paralel menunjukkan efek moderasi.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
