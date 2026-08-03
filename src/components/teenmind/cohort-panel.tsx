'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ErrorBar, Cell,
} from 'recharts'
import { Loader2, FlaskConical, Users, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { CrosstabPanel } from '@/components/teenmind/crosstab-panel'
import { RegressionPanel } from '@/components/teenmind/regression-panel'
import { ReliabilityPanel } from '@/components/teenmind/reliability-panel'
import { LogisticPanel } from '@/components/teenmind/logistic-panel'
import { FactorPanel } from '@/components/teenmind/factor-panel'
import { ClusterPanel } from '@/components/teenmind/cluster-panel'
import { MediationPanel } from '@/components/teenmind/mediation-panel'
import { ModerationPanel } from '@/components/teenmind/moderation-panel'
import { PartialCorrPanel } from '@/components/teenmind/partial-corr-panel'

type GroupStat = {
  name: string
  n: number
  mean: number
  sd: number
  se: number
  min: number
  max: number
}

type Significance = {
  test: string
  statistic: number
  pValue: number
  significant: boolean
  description: string
  effectSize?: { name: string; value: number; interpretation: string }
  postHoc?: {
    pairs: { groups: [string, string]; meanDiff: number; pValue: number; pAdj: number; significant: boolean }[]
    test: string
    correction: string
  }
} | null

type CohortData = {
  groupBy: string
  metric: string
  groups: GroupStat[]
  significance: Significance
}

const GROUP_OPTIONS = [
  { value: 'school', label: 'Sekolah' },
  { value: 'gender', label: 'Jenis Kelamin' },
  { value: 'age', label: 'Usia' },
  { value: 'classGrade', label: 'Kelas' },
]

const METRIC_OPTIONS = [
  { value: 'cesdr', label: 'CESD-R (Depresi)', color: '#fb7185', max: 60 },
  { value: 'psqi', label: 'PSQI (Tidur)', color: '#a5b4fc', max: 21 },
  { value: 'mos', label: 'MOS-SSS (Dukungan)', color: '#fcd34d', max: 40 },
  { value: 'bullying', label: 'Bullying', color: '#fdba74', max: 24 },
  { value: 'religiosity', label: 'Religiusitas', color: '#86efac', max: 40 },
]

const CHART_COLORS = ['#7dd3c0', '#a5b4fc', '#fcd34d', '#f9a8d4', '#86efac', '#fdba74']

export function CohortPanel() {
  const [groupBy, setGroupBy] = useState('school')
  const [metric, setMetric] = useState('cesdr')
  const [data, setData] = useState<CohortData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async (gb: string, m: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cohort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupBy: gb, metric: m }),
      })
      const d = await res.json()
      if (d.groups) setData(d)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(groupBy, metric)
  }, [groupBy, metric])

  const metricMeta = METRIC_OPTIONS.find(m => m.value === metric)!

  const chartData = data?.groups.map(g => ({
    name: g.name.length > 15 ? g.name.slice(0, 13) + '…' : g.name,
    fullName: g.name,
    mean: g.mean,
    error: [g.se, g.se],
    n: g.n,
  })) ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Analisis Kohort</h3>
              <p className="text-xs text-white/80">
                Bandingkan skor antar kelompok demografi + uji signifikansi statistik
              </p>
            </div>
          </div>
        </div>
        <div className="p-5">
          {/* Controls */}
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Kelompokkan Berdasarkan
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GROUP_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      groupBy === opt.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Metrik Skor
              </label>
              <div className="flex flex-wrap gap-1.5">
                {METRIC_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMetric(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      metric === opt.value
                        ? 'text-white shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    style={metric === opt.value ? { backgroundColor: opt.color } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : data && data.groups.length > 0 ? (
            <div className="space-y-5">
              {/* Grouped bar chart with error bars */}
              <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Rerata {metricMeta.label} per Kelompok
                  </h4>
                  <span className="text-[10px] text-muted-foreground">Error bars = SE</span>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 16, right: 16, left: -8, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number, _: string, props: { payload?: { n?: number; fullName?: string } }) => [
                          `${v} (n=${props?.payload?.n ?? '?'})`,
                          'Mean',
                        ]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                      />
                      <Bar dataKey="mean" radius={[8, 8, 0, 0]} maxBarSize={60}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                        <ErrorBar dataKey="error" width={4} strokeWidth={1.5} stroke="oklch(0.4 0.02 250)" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Significance test result */}
              {data.significance && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl p-4 ring-1 ${
                    data.significance.significant
                      ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900'
                      : 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                      data.significance.significant
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}>
                      {data.significance.significant ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-bold text-foreground">{data.significance.test}</h5>
                        <Badge variant={data.significance.significant ? 'destructive' : 'default'} className="text-[10px]">
                          p = {data.significance.pValue < 0.001 ? '<0.001' : data.significance.pValue}
                        </Badge>
                        {data.significance.significant && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertCircle className="h-3 w-3" /> Signifikan
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-foreground/80">{data.significance.description}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-white/50 px-2 py-1 dark:bg-white/5">
                          <span className="text-muted-foreground">Statistik: </span>
                          <span className="font-bold text-foreground">{data.significance.statistic}</span>
                        </div>
                        <div className="rounded-lg bg-white/50 px-2 py-1 dark:bg-white/5">
                          <span className="text-muted-foreground">α = 0.05</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Effect size */}
              {data.significance?.effectSize && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100 dark:from-indigo-950/20 dark:to-violet-950/20 dark:ring-indigo-900/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ukuran Efek</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{data.significance.effectSize.name}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                        {data.significance.effectSize.value}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          data.significance.effectSize.interpretation === "Besar"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                            : data.significance.effectSize.interpretation === "Sedang"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        }`}
                      >
                        {data.significance.effectSize.interpretation}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 p-4 ring-1 ring-teal-100 dark:from-teal-950/20 dark:to-emerald-950/20 dark:ring-teal-900/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statistik Uji</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{data.significance.test}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">
                        {data.significance.statistic}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        p = {data.significance.pValue < 0.001 ? "<0.001" : data.significance.pValue}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Post-hoc Tukey HSD */}
              {data.significance?.postHoc && data.significance.postHoc.pairs.length > 0 && (
                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/10">
                  <div className="mb-3 flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h5 className="text-sm font-bold text-foreground">
                      Post-hoc: {data.significance.postHoc.test}
                    </h5>
                    <Badge variant="outline" className="text-[9px] gap-1">
                      {data.significance.postHoc.correction} correction
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {data.significance.postHoc.pairs.map((pair, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                          pair.significant
                            ? "bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900"
                            : "bg-white/50 dark:bg-white/5"
                        }`}
                      >
                        <span className="font-medium text-foreground">
                          {pair.groups[0]} ↔ {pair.groups[1]}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Δμ = {pair.meanDiff}</span>
                          <span className="text-[10px] text-muted-foreground">
                            p = {pair.pValue < 0.001 ? '<0.001' : pair.pValue}
                          </span>
                          <Badge
                            variant={pair.significant ? 'destructive' : 'secondary'}
                            className="text-[9px]"
                          >
                            p<sub>adj</sub> = {pair.pAdj < 0.001 ? '<0.001' : pair.pAdj}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    p<sub>adj</sub> = p-value setelah koreksi Bonferroni (multiply by number of comparisons)
                  </p>
                </div>
              )}

              {/* Group stats table */}
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Kelompok</th>
                      <th className="px-2 py-2 text-center font-semibold">N</th>
                      <th className="px-2 py-2 text-center font-semibold">Mean</th>
                      <th className="px-2 py-2 text-center font-semibold">SD</th>
                      <th className="px-2 py-2 text-center font-semibold">SE</th>
                      <th className="px-2 py-2 text-center font-semibold">Min</th>
                      <th className="px-2 py-2 text-center font-semibold">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((g, i) => (
                      <tr key={g.name} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-3 w-3 flex-shrink-0 rounded-sm"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="font-medium text-foreground">{g.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center text-muted-foreground">{g.n}</td>
                        <td className="px-2 py-2.5 text-center font-bold text-foreground">{g.mean}</td>
                        <td className="px-2 py-2.5 text-center text-muted-foreground">{g.sd}</td>
                        <td className="px-2 py-2.5 text-center text-muted-foreground">{g.se}</td>
                        <td className="px-2 py-2.5 text-center text-muted-foreground">{g.min}</td>
                        <td className="px-2 py-2.5 text-center text-muted-foreground">{g.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Interpretation note */}
              <div className="rounded-xl bg-violet-50/50 p-3 text-xs text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/20 dark:text-violet-300 dark:ring-violet-900/30">
                <strong>📖 Interpretasi:</strong> {metricMeta.label} dikelompokkan berdasarkan{' '}
                {GROUP_OPTIONS.find(g => g.value === groupBy)?.label}. {data.significance?.significant
                  ? 'Terdapat perbedaan yang signifikan secara statistik antar kelompok (p < 0.05).'
                  : 'Tidak terdapat perbedaan yang signifikan secara statistik antar kelompok (p ≥ 0.05).'}
                {' '}Periksa ukuran sampel (N) — kelompok kecil ({'<'}30) mungkin kurang representatif.
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada data responden selesai</p>
            </div>
          )}
        </div>
      </Card>

      {/* Cross-tabulation with chi-square */}
      <CrosstabPanel />

      {/* Multiple linear regression */}
      <RegressionPanel />

      {/* Logistic regression for high-risk prediction */}
      <LogisticPanel />

      {/* Reliability analysis (Cronbach's alpha) */}
      <ReliabilityPanel />

      {/* Factor analysis / PCA */}
      <FactorPanel />

      {/* Cluster analysis (k-means) */}
      <ClusterPanel />

      {/* Mediation analysis */}
      <MediationPanel />

      {/* Moderation analysis */}
      <ModerationPanel />

      {/* Partial correlation */}
      <PartialCorrPanel />
    </div>
  )
}
