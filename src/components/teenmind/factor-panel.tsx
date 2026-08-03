'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LineChart, Line,
} from 'recharts'
import { Loader2, Layers, AlertCircle, CheckCircle2, Grid2x2 } from 'lucide-react'

type Eigenvalue = {
  factor: number
  eigenvalue: number
  variancePct: number
  cumulativePct: number
  kaiserCriterion: boolean
}

type FactorData = {
  instrument: string
  instrumentName: string
  n: number
  numItems: number
  numFactors: number
  eigenvalues: Eigenvalue[]
  loadings: { item: number; [key: string]: number }[]
  communalities: { item: number; communality: number }[]
  kmo: number
  kmoInterpretation: string
  bartlett: {
    chiSquare: number
    df: number
    pValue: number
    significant: boolean
  }
}

const INSTRUMENTS = [
  { value: 'cesdr', label: 'CESD-R (20 item)', color: '#fb7185' },
  { value: 'mos', label: 'MOS-SSS (8 item)', color: '#fcd34d' },
  { value: 'bullying', label: 'Bullying (8 item)', color: '#fdba74' },
  { value: 'religiosity', label: 'Religiusitas (8 item)', color: '#86efac' },
]

export function FactorPanel() {
  const [instrument, setInstrument] = useState('cesdr')
  const [data, setData] = useState<FactorData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/factor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instrument }),
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
  }, [instrument])

  const instMeta = INSTRUMENTS.find(i => i.value === instrument)!

  // Scree plot data (eigenvalues)
  const screeData = data?.eigenvalues.map(e => ({
    factor: `F${e.factor}`,
    eigenvalue: e.eigenvalue,
    kaiser: e.kaiserCriterion,
  })) ?? []

  // Factor loading matrix keys
  const factorKeys = data ? Array.from({ length: data.numFactors }, (_, i) => `F${i + 1}`) : []

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Faktor (PCA)</h3>
            <p className="text-xs text-white/80">Principal Component Analysis · Validasi konstruk instrumen</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {/* Instrument selector */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Pilih Instrumen</label>
          <div className="flex flex-wrap gap-1.5">
            {INSTRUMENTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setInstrument(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  instrument === opt.value
                    ? 'text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                style={instrument === opt.value ? { backgroundColor: opt.color } : {}}
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
            {/* KMO + Bartlett stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 p-3 text-center ring-1 ring-indigo-100 dark:from-indigo-950/20 dark:to-blue-950/20 dark:ring-indigo-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">KMO</p>
                <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{data.kmo}</p>
                <p className="text-[10px] text-muted-foreground">{data.kmoInterpretation}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-teal-50 p-3 text-center ring-1 ring-cyan-100 dark:from-cyan-950/20 dark:to-teal-950/20 dark:ring-cyan-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Bartlett χ²</p>
                <p className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">{data.bartlett.chiSquare}</p>
                <p className="text-[10px] text-muted-foreground">p = {data.bartlett.pValue < 0.001 ? '<0.001' : data.bartlett.pValue}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 text-center ring-1 ring-violet-100 dark:from-violet-950/20 dark:to-fuchsia-950/20 dark:ring-violet-900/30">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Faktor Diekstrak</p>
                <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{data.numFactors}</p>
                <p className="text-[10px] text-muted-foreground">dari {data.numItems} item</p>
              </div>
            </div>

            {/* KMO/Bartlett interpretation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${
                data.kmo >= 0.6 && data.bartlett.significant
                  ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
                  : 'bg-amber-50 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  data.kmo >= 0.6 && data.bartlett.significant
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                }`}>
                  {data.kmo >= 0.6 && data.bartlett.significant ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-semibold text-foreground">
                    {data.kmo >= 0.6 && data.bartlett.significant
                      ? 'Data cocok untuk analisis faktor'
                      : 'Data mungkin kurang cocok untuk analisis faktor'}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    KMO = {data.kmo} ({data.kmoInterpretation}). Bartlett's test χ²({data.bartlett.df}) = {data.bartlett.chiSquare},
                    p = {data.bartlett.pValue < 0.001 ? '<0.001' : data.bartlett.pValue}.
                    KMO {`≥`} 0.6 dan Bartlett signifikan (p {`<`} 0.05) diperlukan untuk PCA yang valid.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Scree plot */}
            <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Scree Plot (Eigenvalues)</h4>
                <span className="text-[10px] text-muted-foreground">Garis merah = Kaiser criterion (eigenvalue = 1)</span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={screeData} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                    <XAxis dataKey="factor" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} label={{ value: 'Eigenvalue', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'oklch(0.5 0.02 250)' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                    <ReferenceLine y={1} stroke="#fb7185" strokeWidth={1.5} strokeDasharray="4 4" />
                    <Bar dataKey="eigenvalue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {screeData.map((entry, i) => (
                        <Cell key={i} fill={entry.kaiser ? '#7c3aed' : '#cbd5e1'} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Faktor dengan eigenvalue {`>`} 1 (ungu) dipertahankan berdasarkan Kaiser criterion.
                Total varians dijelaskan: {data.eigenvalues.slice(0, data.numFactors).reduce((a, b) => a + b.variancePct, 0).toFixed(1)}%
              </p>
            </div>

            {/* Factor loadings table */}
            <div className="overflow-x-auto scrollbar-thin">
              <div className="mb-2 flex items-center gap-2">
                <Grid2x2 className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Matriks Loading Faktor</h4>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Item</th>
                    {factorKeys.map(fk => (
                      <th key={fk} className="px-2 py-2 text-center font-semibold">{fk}</th>
                    ))}
                    <th className="px-2 py-2 text-center font-semibold">Komunalitas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.loadings.map((row, i) => {
                    const comm = data.communalities[i]?.communality ?? 0
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium text-foreground">Item {row.item}</td>
                        {factorKeys.map(fk => {
                          const val = row[fk] as number
                          const highLoading = Math.abs(val) >= 0.4
                          return (
                            <td key={fk} className="px-2 py-2 text-center font-mono text-xs">
                              <span className={highLoading ? 'font-bold text-violet-600' : 'text-muted-foreground'}>
                                {val}
                              </span>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          <span className={comm < 0.3 ? 'text-rose-600 font-bold' : 'text-foreground'}>
                            {comm}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Eigenvalues table */}
            <div className="overflow-x-auto scrollbar-thin">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Eigenvalues & Varians Dijelaskan</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Faktor</th>
                    <th className="px-2 py-2 text-center font-semibold">Eigenvalue</th>
                    <th className="px-2 py-2 text-center font-semibold">% Varians</th>
                    <th className="px-2 py-2 text-center font-semibold">% Kumulatif</th>
                    <th className="px-2 py-2 text-center font-semibold">Kaiser</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eigenvalues.map((e) => (
                    <tr key={e.factor} className={`border-b last:border-0 ${e.factor <= data.numFactors ? 'bg-violet-50/30 dark:bg-violet-950/10' : ''}`}>
                      <td className="py-2 pr-3 font-medium text-foreground">Faktor {e.factor}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs font-bold text-foreground">{e.eigenvalue}</td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{e.variancePct}%</td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{e.cumulativePct}%</td>
                      <td className="px-2 py-2 text-center">
                        {e.kaiserCriterion ? (
                          <Badge className="text-[9px] bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">✓ Retained</Badge>
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
            <div className="rounded-xl bg-indigo-50/50 p-3 text-xs text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-300 dark:ring-indigo-900/30">
              <strong className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Interpretasi:</strong>
              <p className="mt-1 leading-relaxed">
                PCA mengekstrak <strong>{data.numFactors} faktor</strong> dari {data.numItems} item {data.instrumentName},
                menjelaskan <strong>{data.eigenvalues.slice(0, data.numFactors).reduce((a, b) => a + b.variancePct, 0).toFixed(1)}%</strong> varians.
                Item dengan loading {`≥`} 0.4 (ungu) berkontribusi pada faktor tersebut.
                Komunalitas {`<`} 0.3 (merah) menunjukkan item kurang terjelaskan oleh model faktor.
                KMO = {data.kmo} ({data.kmoInterpretation}).
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
