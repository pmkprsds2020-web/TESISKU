'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, Gauge } from 'lucide-react'

type ItemStat = {
  item: number
  mean: number
  sd: number
  itemTotalCorr: number
  alphaIfDeleted: number
}

type ReliabilityData = {
  instrument: string
  instrumentName: string
  n: number
  numItems: number
  cronbachAlpha: number
  interpretation: string
  totalMean: number
  totalSD: number
  itemStats: ItemStat[]
}

const INSTRUMENTS = [
  { value: 'cesdr', label: 'CESD-R (20 item)', color: '#fb7185' },
  { value: 'mos', label: 'MOS-SSS (8 item)', color: '#fcd34d' },
  { value: 'bullying', label: 'Bullying (8 item)', color: '#fdba74' },
  { value: 'religiosity', label: 'Religiusitas (8 item)', color: '#86efac' },
]

function getAlphaColor(alpha: number) {
  if (alpha >= 0.7) return { bg: 'from-emerald-400 to-teal-500', text: 'text-emerald-600', dark: 'dark:text-emerald-400' }
  if (alpha >= 0.6) return { bg: 'from-amber-400 to-orange-500', text: 'text-amber-600', dark: 'dark:text-amber-400' }
  return { bg: 'from-rose-400 to-red-500', text: 'text-rose-600', dark: 'dark:text-rose-400' }
}

export function ReliabilityPanel() {
  const [instrument, setInstrument] = useState('cesdr')
  const [data, setData] = useState<ReliabilityData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/reliability', {
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
  const alphaColor = data ? getAlphaColor(data.cronbachAlpha) : getAlphaColor(0)

  // Chart data for item-total correlations
  const chartData = data?.itemStats.map(s => ({
    name: `I${s.item}`,
    corr: s.itemTotalCorr,
    alphaIfDeleted: s.alphaIfDeleted,
    currentAlpha: data.cronbachAlpha,
  })) ?? []

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Analisis Reliabilitas Instrumen</h3>
            <p className="text-xs text-white/80">Cronbach's Alpha · Validitas internal instrumen</p>
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
            {/* Alpha gauge + stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Alpha gauge */}
              <div className={`rounded-2xl bg-gradient-to-br ${alphaColor.bg} p-5 text-center text-white shadow-lg`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Cronbach's α</p>
                <p className="my-2 text-5xl font-extrabold">{data.cronbachAlpha}</p>
                <Badge className="bg-white/20 text-white hover:bg-white/30">{data.interpretation}</Badge>
              </div>
              {/* Stats */}
              <div className="space-y-2">
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Jumlah Item</p>
                  <p className="text-xl font-bold text-foreground">{data.numItems}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Responden (N)</p>
                  <p className="text-xl font-bold text-foreground">{data.n}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Mean Total</p>
                  <p className="text-xl font-bold text-foreground">{data.totalMean}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">SD Total</p>
                  <p className="text-xl font-bold text-foreground">{data.totalSD}</p>
                </div>
              </div>
            </div>

            {/* Interpretation guide */}
            <div className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ${
              data.cronbachAlpha >= 0.7
                ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900'
                : 'bg-amber-50 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900'
            }`}>
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                data.cronbachAlpha >= 0.7
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              }`}>
                {data.cronbachAlpha >= 0.7 ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              </div>
              <div className="flex-1 text-xs">
                <p className="font-semibold text-foreground">
                  {data.cronbachAlpha >= 0.7
                    ? 'Instrumen reliabel — siap untuk penelitian'
                    : 'Reliabilitas rendah — pertimbangkan revisi instrumen'}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  α {`≥`} 0.7 = dapat diterima · {`≥`} 0.8 = baik · {`≥`} 0.9 = sangat baik.
                  Item dengan korelasi item-total {`<`} 0.3 sebaiknya ditinjau.
                </p>
              </div>
            </div>

            {/* Item-total correlation chart */}
            {chartData.length > 0 && (
              <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Korelasi Item-Total per Item
                  </h4>
                  <span className="text-[10px] text-muted-foreground">Garis merah = ambang 0.3</span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[-0.2, 1]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number) => [v, 'r(item-total)']}
                      />
                      <ReferenceLine y={0.3} stroke="#fb7185" strokeWidth={1.5} strokeDasharray="4 4" />
                      <Bar dataKey="corr" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.corr < 0.3 ? '#fb7185' : instMeta.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Item statistics table */}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Item</th>
                    <th className="px-2 py-2 text-center font-semibold">Mean</th>
                    <th className="px-2 py-2 text-center font-semibold">SD</th>
                    <th className="px-2 py-2 text-center font-semibold">r(item-total)</th>
                    <th className="px-2 py-2 text-center font-semibold">α if deleted</th>
                    <th className="px-2 py-2 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itemStats.map((s) => {
                    const lowCorr = s.itemTotalCorr < 0.3
                    const alphaImproves = s.alphaIfDeleted > data.cronbachAlpha
                    return (
                      <tr key={s.item} className={`border-b last:border-0 ${lowCorr ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''}`}>
                        <td className="py-2 pr-3 font-medium text-foreground">Item {s.item}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{s.mean}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{s.sd}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          <span className={lowCorr ? 'font-bold text-rose-600' : 'text-foreground'}>
                            {s.itemTotalCorr}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          <span className={alphaImproves ? 'font-bold text-amber-600' : 'text-muted-foreground'}>
                            {s.alphaIfDeleted}
                          </span>
                          {alphaImproves && <span className="ml-1 text-[9px] text-amber-600">↑</span>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {lowCorr ? (
                            <Badge variant="destructive" className="text-[9px]">Tinjau</Badge>
                          ) : alphaImproves ? (
                            <Badge variant="outline" className="text-[9px] text-amber-600">Hapus?</Badge>
                          ) : (
                            <span className="text-xs text-emerald-500">✓</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl bg-violet-50/50 p-3 text-xs text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/20 dark:text-violet-300 dark:ring-violet-900/30">
              <strong className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> Interpretasi:</strong>
              <p className="mt-1 leading-relaxed">
                Cronbach's α = {data.cronbachAlpha} menunjukkan reliabilitas <strong>{data.interpretation.toLowerCase()}</strong>.
                Item dengan r(item-total) {`<`} 0.3 (ditandai merah) berkontribusi rendah dan sebaiknya ditinjau.
                Jika α-if-deleted lebih tinggi dari α keseluruhan (tanda ↑), menghapus item tersebut dapat meningkatkan reliabilitas.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
