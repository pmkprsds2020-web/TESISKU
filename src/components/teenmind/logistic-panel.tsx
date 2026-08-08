'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  LineChart, Line, Area, AreaChart, ReferenceDot,
} from 'recharts'
import { Loader2, Brain, AlertCircle, CheckCircle2, Target, TrendingUp, Activity } from 'lucide-react'

type Coefficient = {
  name: string
  label?: string
  beta: number
  se: number
  z: number
  pValue: number
  oddsRatio: number
  orCI95Lower: number
  orCI95Upper: number
  significant?: boolean
}

type LogisticData = {
  predictors: string[]
  n: number
  positives: number
  negatives: number
  converged: boolean
  coefficients: Coefficient[]
  modelFit: {
    logLikelihood: number
    nullLogLikelihood: number
    lrStatistic: number
    lrPValue: number
    mcfaddenR2: number
  }
  classification: {
    accuracy: number
    sensitivity: number
    specificity: number
    truePos: number
    falsePos: number
    trueNeg: number
    falseNeg: number
  }
  roc?: {
    auc: number
    points: { threshold: number; tpr: number; fpr: number }[]
    optimalThreshold: number
    youdensJ: number
    interpretation: string
  }
  description: string
}

const PREDICTOR_OPTIONS = [
  { value: 'psqi', label: 'PSQI (Tidur)' },
  { value: 'mos', label: 'MOS-SSS (Dukungan)' },
  { value: 'bullying', label: 'Bullying (GBS)' },
  { value: 'climate', label: 'Climate School' },
  { value: 'religiosity', label: 'Religiusitas' },
  { value: 'age', label: 'Usia' },
]

const CHART_COLORS = ['#7dd3c0', '#a5b4fc', '#fcd34d', '#f9a8d4', '#86efac']

export function LogisticPanel() {
  const [selectedPredictors, setSelectedPredictors] = useState<Set<string>>(new Set(['psqi', 'mos', 'religiosity']))
  const [data, setData] = useState<LogisticData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedPredictors.size === 0) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/logistic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictors: Array.from(selectedPredictors) }),
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
  }, [selectedPredictors])

  function togglePredictor(p: string) {
    setSelectedPredictors(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const chartData = data?.coefficients
    .filter(c => c.name !== 'Intercept')
    .map(c => ({
      name: c.label || c.name,
      oddsRatio: c.oddsRatio,
      pValue: c.pValue,
      significant: c.significant,
    })) ?? []

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Regresi Logistik</h3>
            <p className="text-xs text-white/80">Prediksi High-Risk (binary) · Odds Ratio, Sensitivitas, Spesifisitas</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {/* Predictor selector */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
            Variabel Prediktor — prediksi status High-Risk
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PREDICTOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => togglePredictor(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedPredictors.has(opt.value)
                    ? 'bg-rose-500 text-white shadow-sm'
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
            {/* Model fit + classification stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 p-3 text-center ring-1 ring-rose-100 dark:from-rose-950/20 dark:to-pink-950/20 dark:ring-rose-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Akurasi</p>
                <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{Math.round(data.classification.accuracy * 100)}%</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 text-center ring-1 ring-violet-100 dark:from-violet-950/20 dark:to-fuchsia-950/20 dark:ring-violet-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">McFadden R²</p>
                <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{data.modelFit.mcfaddenR2}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-center ring-1 ring-amber-100 dark:from-amber-950/20 dark:to-orange-950/20 dark:ring-amber-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Sensitivitas</p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{Math.round(data.classification.sensitivity * 100)}%</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 p-3 text-center ring-1 ring-teal-100 dark:from-teal-950/20 dark:to-emerald-950/20 dark:ring-teal-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Spesifisitas</p>
                <p className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">{Math.round(data.classification.specificity * 100)}%</p>
              </div>
            </div>

            {/* Model significance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${
                data.modelFit.lrPValue < 0.05
                  ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900'
                  : 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  data.modelFit.lrPValue < 0.05
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {data.modelFit.lrPValue < 0.05 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">Likelihood Ratio Test</h5>
                    <Badge variant={data.modelFit.lrPValue < 0.05 ? 'destructive' : 'default'} className="text-[10px]">
                      p = {data.modelFit.lrPValue < 0.001 ? '<0.001' : data.modelFit.lrPValue}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">{data.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">χ² = </span>
                      <span className="font-bold text-foreground">{data.modelFit.lrStatistic}</span>
                    </span>
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">Positif: </span>
                      <span className="font-bold text-rose-600">{data.positives}</span>
                      <span className="text-muted-foreground"> / Negatif: </span>
                      <span className="font-bold text-emerald-600">{data.negatives}</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Confusion matrix */}
            <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Confusion Matrix</h4>
              <div className="mx-auto grid max-w-xs grid-cols-2 gap-1 text-center">
                <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">True Negatif</p>
                  <p className="text-2xl font-bold text-foreground">{data.classification.trueNeg}</p>
                </div>
                <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-950/30">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">False Positif</p>
                  <p className="text-2xl font-bold text-foreground">{data.classification.falsePos}</p>
                </div>
                <div className="rounded-lg bg-rose-100 p-3 dark:bg-rose-950/30">
                  <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-400">False Negatif</p>
                  <p className="text-2xl font-bold text-foreground">{data.classification.falseNeg}</p>
                </div>
                <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">True Positif</p>
                  <p className="text-2xl font-bold text-foreground">{data.classification.truePos}</p>
                </div>
              </div>
            </div>

            {/* ROC Curve */}
            {data.roc && (
              <div className="rounded-2xl bg-gradient-to-br from-violet-50/50 to-fuchsia-50/50 p-4 ring-1 ring-violet-100 dark:from-violet-950/10 dark:to-fuchsia-950/10 dark:ring-violet-900/30">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-violet-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">ROC Curve</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${data.roc.auc >= 0.8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : data.roc.auc >= 0.7 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'}`}>
                      AUC = {data.roc.auc}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{data.roc.interpretation}</span>
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...data.roc.points].sort((a, b) => a.fpr - b.fpr)} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
                      <defs>
                        <linearGradient id="rocGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a5b4fc" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis
                        type="number"
                        dataKey="fpr"
                        domain={[0, 1]}
                        tick={{ fontSize: 10 }}
                        label={{ value: '1 - Spesifisitas (FPR)', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'oklch(0.5 0.02 250)' }}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tick={{ fontSize: 10 }}
                        label={{ value: 'Sensitivitas (TPR)', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'oklch(0.5 0.02 250)' }}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 11 }}
                        formatter={(_: number, __: string, props: { payload?: { threshold?: number; tpr?: number; fpr?: number } }) => [
                          `TPR: ${props?.payload?.tpr}, FPR: ${props?.payload?.fpr} (threshold: ${props?.payload?.threshold})`,
                          'ROC',
                        ]}
                      />
                      {/* Diagonal reference line (random classifier) */}
                      <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" />
                      <Area
                        type="monotone"
                        dataKey="tpr"
                        stroke="#7c3aed"
                        strokeWidth={2.5}
                        fill="url(#rocGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#7c3aed' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 bg-violet-600" /> ROC Curve
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 bg-slate-300" strokeDasharray="2 2" /> Random (AUC=0.5)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground">Optimal threshold (Youden's J):</span>
                    <Badge variant="outline" className="text-[9px] font-bold">{data.roc.optimalThreshold}</Badge>
                    <span className="text-muted-foreground">J = {data.roc.youdensJ}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Odds ratio chart */}
            {chartData.length > 0 && (
              <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Odds Ratio (OR)</h4>
                  <span className="text-[10px] text-muted-foreground">Garis = OR 1.0 (no effect)</span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v, 'OR']} />
                      <ReferenceLine x={1} stroke="oklch(0.4 0.02 250)" strokeWidth={1} />
                      <Bar dataKey="oddsRatio" radius={[0, 8, 8, 0]} maxBarSize={28}>
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
                    <th className="px-2 py-2 text-center font-semibold">β</th>
                    <th className="px-2 py-2 text-center font-semibold">SE</th>
                    <th className="px-2 py-2 text-center font-semibold">OR</th>
                    <th className="px-2 py-2 text-center font-semibold">CI 95%</th>
                    <th className="px-2 py-2 text-center font-semibold">z</th>
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
                      <td className="px-2 py-2.5 text-center font-mono text-xs font-bold text-foreground">{c.oddsRatio}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-[11px] text-muted-foreground">
                        {c.name === 'Intercept' ? '—' : `${c.orCI95Lower}–${c.orCI95Upper}`}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-muted-foreground">{c.z}</td>
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
            <div className="rounded-xl bg-rose-50/50 p-3 text-xs text-rose-800 ring-1 ring-rose-100 dark:bg-rose-950/20 dark:text-rose-300 dark:ring-rose-900/30">
              <strong className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Interpretasi:</strong>
              <p className="mt-1 leading-relaxed">
                Model regresi logistik memprediksi status <strong>High-Risk</strong> berdasarkan{' '}
                {data.predictors.length} prediktor. Akurasi klasifikasi{' '}
                <strong>{Math.round(data.classification.accuracy * 100)}%</strong> dengan sensitivitas{' '}
                {Math.round(data.classification.sensitivity * 100)}% (deteksi kasus positif) dan spesifisitas{' '}
                {Math.round(data.classification.specificity * 100)}% (deteksi kasus negatif).
                OR {`>`} 1 = prediktor meningkatkan peluang high-risk, OR {`<`} 1 = menurunkan.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
