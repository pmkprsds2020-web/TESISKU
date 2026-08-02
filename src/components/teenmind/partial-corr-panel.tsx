'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Split, AlertCircle, CheckCircle2, Plus, X } from 'lucide-react'

type PartialCorrData = {
  x: string
  y: string
  xLabel?: string
  yLabel?: string
  controls: string[]
  controlLabels?: string[]
  n: number
  zeroOrderR: number
  partialR: number
  pValue: number
  df?: number
  significant: boolean
  reduction?: number
  description: string
}

const VAR_OPTIONS = [
  { value: 'cesdr', label: 'CESD-R' },
  { value: 'psqi', label: 'PSQI' },
  { value: 'mos', label: 'MOS' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'religiosity', label: 'Religiusitas' },
  { value: 'age', label: 'Usia' },
]

function pFormat(p: number) {
  return p < 0.001 ? '<0.001' : p.toFixed(4)
}

export function PartialCorrPanel() {
  const [xVar, setXVar] = useState('bullying')
  const [yVar, setYVar] = useState('cesdr')
  const [controls, setControls] = useState<Set<string>>(new Set(['psqi', 'mos']))
  const [data, setData] = useState<PartialCorrData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (xVar === yVar) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/partial-corr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: xVar, y: yVar, controls: Array.from(controls) }),
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
  }, [xVar, yVar, controls])

  function toggleControl(v: string) {
    if (v === xVar || v === yVar) return
    setControls(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-teal-600 via-emerald-500 to-green-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Split className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Korelasi Parsial</h3>
            <p className="text-xs text-white/80">Korelasi X–Y setelah mengontrol variabel lain</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {/* Variable selectors */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Variabel X</label>
            <select
              value={xVar}
              onChange={(e) => setXVar(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-white/5"
            >
              {VAR_OPTIONS.filter(o => o.value !== yVar).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Variabel Y</label>
            <select
              value={yVar}
              onChange={(e) => setYVar(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-white/5"
            >
              {VAR_OPTIONS.filter(o => o.value !== xVar).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Control variables */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Variabel Kontrol (Z)</label>
          <div className="flex flex-wrap gap-1.5">
            {VAR_OPTIONS.filter(o => o.value !== xVar && o.value !== yVar).map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleControl(opt.value)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  controls.has(opt.value)
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {controls.has(opt.value) ? <CheckCircle2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {opt.label}
              </button>
            ))}
          </div>
          {controls.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Array.from(controls).map(c => (
                <Badge key={c} variant="secondary" className="gap-1 py-1 pl-2 pr-1 text-[10px]">
                  {VAR_OPTIONS.find(v => v.value === c)?.label}
                  <button onClick={() => toggleControl(c)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
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
            {/* Correlation comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-muted/30 p-4 text-center ring-1 ring-slate-200 dark:from-slate-950/20 dark:to-muted/10 dark:ring-slate-800">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Korelasi Zero-Order</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-600 dark:text-slate-300">{data.zeroOrderR}</p>
                <p className="text-[10px] text-muted-foreground">r(X, Y) tanpa kontrol</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center ring-1 ring-emerald-200 dark:from-emerald-950/20 dark:to-teal-950/20 dark:ring-emerald-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Korelasi Parsial</p>
                <p className="mt-1 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{data.partialR}</p>
                <p className="text-[10px] text-muted-foreground">r(X, Y | Z)</p>
              </div>
            </div>

            {/* Reduction indicator */}
            {data.reduction !== undefined && data.reduction > 0 && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50/50 p-2.5 text-xs text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/20 dark:text-amber-300">
                <span>↘</span>
                <span>Korelasi berkurang <strong>{data.reduction}%</strong> setelah mengontrol {data.controlLabels?.join(", ")}</span>
              </div>
            )}

            {/* Significance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${
                data.significant
                  ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900'
                  : 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  data.significant
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {data.significant ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">
                      {data.significant ? "Korelasi Parsial Signifikan" : "Korelasi Parsial Tidak Signifikan"}
                    </h5>
                    <Badge variant={data.significant ? 'destructive' : 'default'} className="text-[10px]">
                      p = {pFormat(data.pValue)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">{data.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">r = </span>
                      <span className="font-bold text-foreground">{data.partialR}</span>
                    </span>
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">df = </span>
                      <span className="font-bold text-foreground">{data.df}</span>
                    </span>
                    <span className="rounded-lg bg-white/50 px-2 py-1 text-[11px] dark:bg-white/5">
                      <span className="text-muted-foreground">N = </span>
                      <span className="font-bold text-foreground">{data.n}</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Interpretation */}
            <div className="rounded-xl bg-teal-50/50 p-3 text-xs text-teal-800 ring-1 ring-teal-100 dark:bg-teal-950/20 dark:text-teal-300 dark:ring-teal-900/30">
              <strong className="flex items-center gap-1"><Split className="h-3.5 w-3.5" /> Interpretasi:</strong>
              <p className="mt-1 leading-relaxed">
                Korelasi parsial mengukur hubungan unik antara <strong>{data.xLabel || data.x}</strong> dan{' '}
                <strong>{data.yLabel || data.y}</strong> setelah menghapus varians yang dijelaskan oleh{' '}
                {data.controls.length > 0 ? <strong>{data.controlLabels?.join(", ")}</strong> : <strong>tidak ada kontrol</strong>}.
                {data.reduction !== undefined && data.reduction > 5
                  ? ` Berkurang ${data.reduction}% dari zero-order, menunjukkan variabel kontrol menjelaskan sebagian hubungan.`
                  : ` Berkurang hanya ${data.reduction}% — hubungan X-Y relatif unik dan tidak terpengaruh variabel kontrol.`
                }
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
