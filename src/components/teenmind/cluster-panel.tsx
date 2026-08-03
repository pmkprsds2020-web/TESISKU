'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ZAxis, Legend,
} from 'recharts'
import { Loader2, Boxes, AlertCircle, Users } from 'lucide-react'

type ClusterData = {
  variables: string[]
  variableLabels: string[]
  k: number
  n: number
  converged: boolean
  wcss: number
  rSquared: number
  clusters: {
    cluster: number
    n: number
    means: Record<string, number>
    codes: string[]
    label: string
  }[]
  centroids: Record<string, number>[]
  assignments: { code: string; cluster: number; values: Record<string, number> }[]
  description: string
}

const VAR_OPTIONS = [
  { value: 'cesdr', label: 'CESD-R' },
  { value: 'psqi', label: 'PSQI' },
  { value: 'mos', label: 'MOS' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'religiosity', label: 'Religiusitas' },
]

const CLUSTER_COLORS = ['#7dd3c0', '#a5b4fc', '#fcd34d', '#f9a8d4', '#86efac']

export function ClusterPanel() {
  const [variables, setVariables] = useState<Set<string>>(new Set(['cesdr', 'psqi', 'mos']))
  const [k, setK] = useState(3)
  const [data, setData] = useState<ClusterData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (variables.size < 2) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/cluster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variables: Array.from(variables), k }),
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
  }, [variables, k])

  function toggleVar(v: string) {
    setVariables(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  // Scatter plot: use first 2 variables
  const var1 = data?.variables[0] ?? ''
  const var2 = data?.variables[1] ?? ''
  const var1Label = data?.variableLabels[0] ?? ''
  const var2Label = data?.variableLabels[1] ?? ''

  // Group assignments by cluster for scatter
  const scatterData = data ? Array.from({ length: data.k }, (_, c) => ({
    cluster: c + 1,
    label: data.clusters[c]?.label || `Klaster ${c + 1}`,
    data: data.assignments
      .filter(a => a.cluster === c + 1)
      .map(a => ({ x: a.values[var1], y: a.values[var2], code: a.code })),
    centroid: { x: data.centroids[c]?.[var1], y: data.centroids[c]?.[var2] },
  })) : []

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Klaster (K-Means)</h3>
            <p className="text-xs text-white/80">Segmentasi responden berdasarkan profil skor</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {/* Variable selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Variabel (minimal 2)</label>
          <div className="flex flex-wrap gap-1.5">
            {VAR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleVar(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  variables.has(opt.value)
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* K selector */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Jumlah Klaster (k)</label>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5].map(kVal => (
              <button
                key={kVal}
                onClick={() => setK(kVal)}
                className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${
                  k === kVal
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {kVal}
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
            {/* Model stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-50 p-3 text-center ring-1 ring-cyan-100 dark:from-cyan-950/20 dark:to-sky-950/20 dark:ring-cyan-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">R²</p>
                <p className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">{data.rSquared}</p>
                <p className="text-[10px] text-muted-foreground">{Math.round(data.rSquared * 100)}% varians</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 text-center ring-1 ring-violet-100 dark:from-violet-950/20 dark:to-fuchsia-950/20 dark:ring-violet-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">WCSS</p>
                <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{data.wcss}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-center ring-1 ring-amber-100 dark:from-amber-950/20 dark:to-orange-950/20 dark:ring-amber-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Responden</p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{data.n}</p>
                <p className="text-[10px] text-muted-foreground">{data.k} klaster</p>
              </div>
            </div>

            {/* Scatter plot with centroids */}
            {var1 && var2 && (
              <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Visualisasi Klaster ({var1Label} vs {var2Label})
                  </h4>
                  <span className="text-[10px] text-muted-foreground">★ = centroid</span>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name={var1Label}
                        tick={{ fontSize: 10 }}
                        label={{ value: var1Label, position: 'insideBottom', offset: -5, fontSize: 10, fill: 'oklch(0.5 0.02 250)' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={var2Label}
                        tick={{ fontSize: 10 }}
                        label={{ value: var2Label, angle: -90, position: 'insideLeft', fontSize: 10, fill: 'oklch(0.5 0.02 250)' }}
                      />
                      <ZAxis range={[60, 60]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ borderRadius: 12, fontSize: 11 }}
                        formatter={(_: number, name: string, props: { payload?: { code?: string } }) => [props?.payload?.code, name]}
                      />
                      {scatterData.map((cluster, i) => (
                        <Scatter
                          key={i}
                          name={cluster.label}
                          data={cluster.data}
                          fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                          fillOpacity={0.6}
                        />
                      ))}
                      {/* Centroids */}
                      {scatterData.map((cluster, i) => (
                        <Scatter
                          key={`centroid-${i}`}
                          name={`Centroid ${i + 1}`}
                          data={[cluster.centroid]}
                          fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                          shape="star"
                          fillOpacity={1}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Cluster profiles */}
            <div className="space-y-3">
              {data.clusters.map((cluster, i) => (
                <motion.div
                  key={cluster.cluster}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border-l-4 bg-white p-4 shadow-sm dark:bg-white/5"
                  style={{ borderLeftColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                      >
                        {cluster.cluster}
                      </span>
                      <div>
                        <p className="font-bold text-foreground">{cluster.label}</p>
                        <p className="text-[10px] text-muted-foreground">{cluster.n} responden ({Math.round(cluster.n / data.n * 100)}%)</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[9px]">
                      <Users className="mr-1 h-3 w-3" /> {cluster.n}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.entries(cluster.means).map(([key, val]) => {
                      const varLabel = data.variableLabels[data.variables.indexOf(key)] || key
                      const allMeans = data.clusters.map(c => c.means[key] || 0)
                      const maxMean = Math.max(...allMeans)
                      const minMean = Math.min(...allMeans)
                      const isHighest = val === maxMean && maxMean !== minMean
                      const isLowest = val === minMean && maxMean !== minMean
                      return (
                        <div
                          key={key}
                          className={`rounded-lg px-2.5 py-1.5 text-xs ${
                            isHighest
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300'
                              : isLowest
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                              : 'bg-muted/30 text-foreground'
                          }`}
                        >
                          <span className="text-muted-foreground">{varLabel}:</span>{' '}
                          <span className="font-bold">{val}</span>
                          {isHighest && <span className="ml-1">↑</span>}
                          {isLowest && <span className="ml-1">↓</span>}
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Interpretation */}
            <div className="rounded-xl bg-cyan-50/50 p-3 text-xs text-cyan-800 ring-1 ring-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-300 dark:ring-cyan-900/30">
              <strong className="flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> Interpretasi:</strong>
              <p className="mt-1 leading-relaxed">
                K-means dengan k={data.k} mengelompokkan {data.n} responden menjadi {data.k} segmen berdasarkan{' '}
                {data.variables.length} variabel skor. R² = {data.rSquared} menunjukkan{' '}
                {Math.round(data.rSquared * 100)}% varians antar responden dijelaskan oleh keanggotaan klaster.
                Tanda ↑ (merah) = skor tertinggi, ↓ (hijau) = terendah dibanding klaster lain.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
