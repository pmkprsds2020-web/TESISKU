'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Grid3x3, AlertCircle, CheckCircle2 } from 'lucide-react'

type CrosstabData = {
  var1: string
  var2: string
  rows: string[]
  cols: string[]
  matrix: number[][]
  expected: number[][]
  rowTotals: number[]
  colTotals: number[]
  N: number
  chiSquare: {
    statistic: number
    df: number
    pValue: number
    significant: boolean
    description: string
    effectSize: { name: string; value: number; interpretation: string }
  }
}

const VAR_OPTIONS = [
  { value: 'gender', label: 'Jenis Kelamin' },
  { value: 'school', label: 'Sekolah' },
  { value: 'age', label: 'Usia' },
  { value: 'classGrade', label: 'Kelas' },
  { value: 'highRisk', label: 'High Risk' },
  { value: 'parentIncome', label: 'Pendapatan' },
  { value: 'residence', label: 'Tempat Tinggal' },
]

export function CrosstabPanel() {
  const [var1, setVar1] = useState('gender')
  const [var2, setVar2] = useState('highRisk')
  const [data, setData] = useState<CrosstabData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (var1 === var2) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch('/api/admin/crosstab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ var1, var2 }),
        })
        const d = await r.json()
        if (!cancelled && d.matrix) setData(d)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [var1, var2])

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Grid3x3 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Cross-Tabulation (Chi-Square)</h3>
            <p className="text-xs text-white/80">Uji hubungan antar variabel kategorikal</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {/* Variable selectors */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Variabel Baris</label>
            <div className="flex flex-wrap gap-1.5">
              {VAR_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVar1(opt.value)}
                  disabled={opt.value === var2}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-30 ${
                    var1 === opt.value
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Variabel Kolom</label>
            <div className="flex flex-wrap gap-1.5">
              {VAR_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVar2(opt.value)}
                  disabled={opt.value === var1}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-30 ${
                    var2 === opt.value
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
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
        ) : data ? (
          <div className="space-y-5">
            {/* Chi-square result */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${
                data.chiSquare.significant
                  ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900'
                  : 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  data.chiSquare.significant
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {data.chiSquare.significant ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">Chi-Square Test</h5>
                    <Badge variant={data.chiSquare.significant ? 'destructive' : 'default'} className="text-[10px]">
                      p = {data.chiSquare.pValue < 0.001 ? '<0.001' : data.chiSquare.pValue}
                    </Badge>
                    {data.chiSquare.significant && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertCircle className="h-3 w-3" /> Signifikan
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">{data.chiSquare.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">χ² = </span>
                      <span className="font-bold text-foreground">{data.chiSquare.statistic}</span>
                    </span>
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">df = </span>
                      <span className="font-bold text-foreground">{data.chiSquare.df}</span>
                    </span>
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">{data.chiSquare.effectSize.name}: </span>
                      <span className="font-bold text-foreground">{data.chiSquare.effectSize.value}</span>
                      <span className="ml-1 text-muted-foreground">({data.chiSquare.effectSize.interpretation})</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Contingency table */}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs">
                    <th className="py-2 pr-3 text-left font-semibold text-muted-foreground">
                      {VAR_OPTIONS.find(v => v.value === data.var1)?.label}
                    </th>
                    {data.cols.map((col, j) => (
                      <th key={j} className="px-2 py-2 text-center font-semibold text-muted-foreground">
                        {col}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-bold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-foreground">{row}</td>
                      {data.cols.map((_, j) => {
                        const observed = data.matrix[i][j]
                        const expected = data.expected[i][j]
                        const resid = expected > 0 ? (observed - expected) / Math.sqrt(expected) : 0
                        const absResid = Math.abs(resid)
                        return (
                          <td key={j} className="px-2 py-2 text-center">
                            <div
                              className={`mx-auto w-fit rounded px-2 py-1 text-xs font-semibold ${
                                absResid > 2
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                                  : absResid > 1
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                  : 'text-muted-foreground'
                              }`}
                              title={`Expected: ${expected.toFixed(1)}, Residual: ${resid.toFixed(2)}`}
                            >
                              {observed}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center font-bold text-foreground">{data.rowTotals[i]}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold">
                    <td className="py-2 pr-3 text-foreground">Total</td>
                    {data.colTotals.map((total, j) => (
                      <td key={j} className="px-2 py-2 text-center text-foreground">{total}</td>
                    ))}
                    <td className="px-2 py-2 text-center text-foreground">{data.N}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="font-semibold">Standardized Residuals:</span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-rose-100 dark:bg-rose-950/30" /> |z| {`>`} 2 (sangat berbeda dari ekspektasi)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-amber-100 dark:bg-amber-950/30" /> |z| {`>`} 1 (cukup berbeda)
              </span>
              <span>Hover sel untuk lihat expected count</span>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Pilih dua variabel berbeda</p>
        )}
      </div>
    </Card>
  )
}
