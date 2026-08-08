'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Loader2, Sigma, TrendingUp, AlertCircle, CheckCircle2, Target } from 'lucide-react'

type Coefficient = {
  name: string
  label?: string
  beta: number
  se: number
  t: number
  pValue: number
  standardized: number | null
  significant?: boolean
}

type RegressionData = {
  outcome: string
  predictors: string[]
  n: number
  coefficients: Coefficient[]
  modelFit: {
    rSquared: number
    adjustedR2: number
    fStatistic: number
    fPValue: number
    fDf1: number
    fDf2: number
    rmse: number
  }
  description: string
}

const OUTCOME_OPTIONS = [
  { value: 'cesdr', label: 'CESD-R (Depresi)' },
  { value: 'psqi', label: 'PSQI (Tidur)' },
  { value: 'mos', label: 'MOS-SSS (Dukungan)' },
  { value: 'bullying', label: 'Bullying (GBS)' },
  { value: 'climate', label: 'Climate School' },
  { value: 'religiosity', label: 'Religiusitas' },
]

const PREDICTOR_OPTIONS = [
  { value: 'psqi', label: 'PSQI (Tidur)' },
  { value: 'mos', label: 'MOS-SSS (Dukungan)' },
  { value: 'bullying', label: 'Bullying (GBS)' },
  { value: 'climate', label: 'Climate School' },
  { value: 'religiosity', label: 'Religiusitas' },
  { value: 'age', label: 'Usia' },
]

const CHART_COLORS = ['#7dd3c0', '#a5b4fc', '#fcd34d', '#f9a8d4', '#86efac']

export function RegressionPanel() {
  const [outcome, setOutcome] = useState('cesdr')
  const [selectedPredictors, setSelectedPredictors] = useState<Set<string>>(new Set(['psqi', 'mos', 'religiosity']))
  const [data, setData] = useState<RegressionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedPredictors.size === 0) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/regression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome, predictors: Array.from(selectedPredictors) }),
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
  }, [outcome, selectedPredictors])

  function togglePredictor(p: string) {
    setSelectedPredictors(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  // Chart data: standardized coefficients
  const chartData = data?.coefficients
    .filter(c => c.name !== 'Intercept')
    .map(c => ({
      name: c.label || c.name,
      standardized: c.standardized ?? 0,
      pValue: c.pValue,
      significant: c.significant,
    })) ?? []

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Sigma className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Regresi Linier Berganda</h3>
            <p className="text-xs text-white/80">
              Prediktor variabel outcome · koefisien, R², uji F
            </p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {/* Outcome selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Variabel Outcome (Y)</label>
          <div className="flex flex-wrap gap-1.5">
            {OUTCOME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setOutcome(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  outcome === opt.value
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Predictor selector */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
            Variabel Prediktor (X) — pilih 1 atau lebih
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PREDICTOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => togglePredictor(opt.value)}
                disabled={opt.value === outcome}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-30 ${
                  selectedPredictors.has(opt.value)
                    ? 'bg-fuchsia-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
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
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 text-center ring-1 ring-violet-100 dark:from-violet-950/20 dark:to-fuchsia-950/20 dark:ring-violet-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">R²</p>
                <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{data.modelFit.rSquared}</p>
                <p className="text-[10px] text-muted-foreground">{Math.round(data.modelFit.rSquared * 100)}% varians</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-3 text-center ring-1 ring-indigo-100 dark:from-indigo-950/20 dark:to-violet-950/20 dark:ring-indigo-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Adj. R²</p>
                <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{data.modelFit.adjustedR2}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 p-3 text-center ring-1 ring-teal-100 dark:from-teal-950/20 dark:to-emerald-950/20 dark:ring-teal-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">F-statistic</p>
                <p className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">{data.modelFit.fStatistic}</p>
                <p className="text-[10px] text-muted-foreground">p = {data.modelFit.fPValue < 0.001 ? '<0.001' : data.modelFit.fPValue}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-center ring-1 ring-amber-100 dark:from-amber-950/20 dark:to-orange-950/20 dark:ring-amber-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">N (kasus)</p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{data.n}</p>
                <p className="text-[10px] text-muted-foreground">prediktor: {data.predictors.length}</p>
              </div>
            </div>

            {/* Model significance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${
                data.modelFit.fPValue < 0.05
                  ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900'
                  : 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  data.modelFit.fPValue < 0.05
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {data.modelFit.fPValue < 0.05 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">Uji F Overall</h5>
                    <Badge variant={data.modelFit.fPValue < 0.05 ? 'destructive' : 'default'} className="text-[10px]">
                      p = {data.modelFit.fPValue < 0.001 ? '<0.001' : data.modelFit.fPValue}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">{data.description}</p>
                </div>
              </div>
            </motion.div>

            {/* Standardized coefficients chart */}
            {chartData.length > 0 && (
              <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Koefisien Standardized (β)</h4>
                  <span className="text-[10px] text-muted-foreground">Merah = signifikan (p {`<`} 0.05)</span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v, 'β standardized']} />
                      <ReferenceLine x={0} stroke="oklch(0.4 0.02 250)" strokeWidth={1} />
                      <Bar dataKey="standardized" radius={[0, 8, 8, 0]} maxBarSize={28}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.significant ? '#fb7185' : CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Coefficients table */}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Prediktor</th>
                    <th className="px-2 py-2 text-center font-semibold">B (unstd.)</th>
                    <th className="px-2 py-2 text-center font-semibold">SE</th>
                    <th className="px-2 py-2 text-center font-semibold">β (std.)</th>
                    <th className="px-2 py-2 text-center font-semibold">t</th>
                    <th className="px-2 py-2 text-center font-semibold">p</th>
                    <th className="px-2 py-2 text-center font-semibold">Sig.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coefficients.map((c, i) => (
                    <tr key={i} className={`border-b last:border-0 ${c.name === 'Intercept' ? 'opacity-60' : ''}`}>
                      <td className="py-2.5 pr-3 font-medium text-foreground">{c.label || c.name}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-foreground">{c.beta}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-muted-foreground">{c.se}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs font-bold text-foreground">
                        {c.standardized ?? '—'}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-muted-foreground">{c.t}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs">
                        <span className={c.pValue < 0.05 ? 'font-bold text-rose-600' : 'text-muted-foreground'}>
                          {c.pValue < 0.001 ? '<0.001' : c.pValue}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {c.significant ? (
                          <Badge variant="destructive" className="text-[9px]">Ya</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Interpretation */}
            <div className="rounded-xl bg-violet-50/50 p-3 text-xs text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/20 dark:text-violet-300 dark:ring-violet-900/30">
              <strong className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Interpretasi Model:</strong>
              <p className="mt-1 leading-relaxed">
                Model regresi dengan {data.predictors.length} prediktor menjelaskan{' '}
                <strong>{Math.round(data.modelFit.rSquared * 100)}%</strong> varians pada{' '}
                {OUTCOME_OPTIONS.find(o => o.value === data.outcome)?.label}.
                {data.modelFit.fPValue < 0.05
                  ? ' Model secara keseluruhan signifikan (p < 0.05).'
                  : ' Model secara keseluruhan tidak signifikan (p ≥ 0.05).'}
                {' '}Periksa koefisien standardized (β) untuk mengetahui prediktor terkuat —
                nilai |β| tertinggi menunjukkan kontribusi relatif terbesar.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
