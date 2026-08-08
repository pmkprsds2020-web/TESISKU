'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import { Loader2, GitCompare, X, Users } from 'lucide-react'
import { SCORE_RANGES } from '@/lib/instruments'

type CompareRespondent = {
  code: string
  school: string | null
  highRisk: boolean
  status: string
  gender: string
  age: string
  classGrade: string
  scores: {
    cesdr: number | null
    psqi: number | null
    mos: number | null
    bullying: number | null // GBS (item 1-4) saja
    climate: number | null // Climate School (item 5-12)
    religiosity: number | null
  }
}

const COMPARE_COLORS = ['#7dd3c0', '#a5b4fc', '#fcd34d', '#f9a8d4', '#86efac', '#fdba74']

// NOTE (perbaikan): max di bawah dulu salah untuk mos (40, seharusnya 50),
// bullying (24, dari saat masih gabungan GBS+Climate — sekarang GBS saja
// jadi 12), dan religiosity (40, seharusnya 32). Sekarang diambil dari
// SCORE_RANGES (satu sumber kebenaran) di src/lib/instruments.ts.
const DIMENSIONS = [
  { key: 'cesdr', name: 'Depresi', max: SCORE_RANGES.cesdr.max, invert: true },
  { key: 'psqi', name: 'Gangguan Tidur', max: SCORE_RANGES.psqi.max, invert: true },
  { key: 'mos', name: 'Dukungan Sosial', max: SCORE_RANGES.mos.max, invert: false },
  { key: 'bullying', name: 'Bullying (GBS)', max: SCORE_RANGES.gbs.max, invert: true },
  { key: 'climate', name: 'Climate School', max: SCORE_RANGES.climate.max, invert: true },
  { key: 'religiosity', name: 'Religiusitas', max: SCORE_RANGES.religiosity.max, invert: false },
] as const

export function CompareDialog({
  codes, open, onOpenChange,
}: {
  codes: string[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [respondents, setRespondents] = useState<CompareRespondent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || codes.length < 2) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codes }),
        })
        const d = await res.json()
        if (!cancelled && d.respondents) setRespondents(d.respondents)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, codes])

  // Build radar data: for each dimension, one entry with all respondents' normalized scores
  const radarData = DIMENSIONS.map((dim) => {
    const entry: Record<string, string | number> = { name: dim.name }
    respondents.forEach((r) => {
      const raw = r.scores[dim.key]
      if (raw === null) {
        entry[r.code] = 0
      } else {
        // Normalize to 0-100. For "invert" dimensions (higher=worse), we keep the raw direction
        // so the radar shows actual severity. For non-invert, higher is better.
        entry[r.code] = Math.round((raw / dim.max) * 100)
      }
    })
    return entry
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-[95vw] max-w-3xl overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b bg-gradient-to-r from-violet-50 via-sky-50 to-emerald-50 px-6 py-4 dark:from-violet-950/30 dark:via-sky-950/30 dark:to-emerald-950/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-white/10">
                <GitCompare className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Perbandingan Responden</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {codes.length} responden · Profil skor radar (dinormalisasi 0–100)
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" /> {codes.length}
            </Badge>
          </div>
        </DialogHeader>

        <div className="max-h-[78vh] overflow-y-auto scrollbar-thin px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : respondents.length < 2 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Minimal 2 responden dengan data lengkap diperlukan.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Radar Chart */}
              <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Profil Skor — Overlay</h4>
                  <span className="text-[10px] text-muted-foreground">0–100 (dinormalisasi)</span>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} margin={{ top: 16, right: 32, left: 32, bottom: 16 }}>
                      <PolarGrid stroke="oklch(0.8 0.02 220)" />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'oklch(0.5 0.02 250)' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'oklch(0.6 0.02 250)' }} tickCount={6} />
                      {respondents.map((r, i) => (
                        <Radar
                          key={r.code}
                          name={r.code}
                          dataKey={r.code}
                          stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                          fill={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                          fillOpacity={0.12}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number, name: string) => [`${v}%`, name]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                  <span>🔴 Depresi, Tidur, Bullying: lebih tinggi = lebih buruk</span>
                  <span>🟢 Dukungan & Religiusitas: lebih tinggi = lebih baik</span>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Kode</th>
                      <th className="px-2 py-2 font-semibold">Demografi</th>
                      <th className="px-2 py-2 text-center font-semibold text-rose-600">CESD-R</th>
                      <th className="px-2 py-2 text-center font-semibold text-indigo-600">PSQI</th>
                      <th className="px-2 py-2 text-center font-semibold text-amber-600">MOS</th>
                      <th className="px-2 py-2 text-center font-semibold text-orange-600">Bully</th>
                      <th className="px-2 py-2 text-center font-semibold text-teal-600">Relig</th>
                      <th className="px-2 py-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respondents.map((r, i) => (
                      <tr key={r.code} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-3 w-3 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                            />
                            <span className="font-mono text-xs font-bold">{r.code}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-xs text-muted-foreground">
                          {r.gender === 'perempuan' ? '👩' : '👨'} {r.age}th · {r.school ?? '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`font-bold ${(r.scores.cesdr ?? 0) >= 16 ? 'text-rose-600' : ''}`}>
                            {r.scores.cesdr ?? '—'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/60</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`font-bold ${(r.scores.psqi ?? 0) > 5 ? 'text-indigo-600' : ''}`}>
                            {r.scores.psqi ?? '—'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/21</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="font-bold">{r.scores.mos ?? '—'}</span>
                          <span className="text-[10px] text-muted-foreground">/40</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`font-bold ${(r.scores.bullying ?? 0) >= SCORE_RANGES.gbs.cutoff ? 'text-orange-600' : ''}`}>
                            {r.scores.bullying ?? '—'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/24</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="font-bold">{r.scores.religiosity ?? '—'}</span>
                          <span className="text-[10px] text-muted-foreground">/40</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {r.highRisk ? (
                            <Badge variant="destructive" className="text-[9px]">Risiko</Badge>
                          ) : r.status === 'completed' ? (
                            <Badge variant="default" className="text-[9px]">Selesai</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px]">Proses</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Insights */}
              <div className="rounded-2xl bg-violet-50/50 p-4 ring-1 ring-violet-100 dark:bg-violet-950/20 dark:ring-violet-900/30">
                <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Insight Cepat</h5>
                <div className="space-y-1.5 text-xs text-foreground/80">
                  {generateInsights(respondents)}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function generateInsights(respondents: CompareRespondent[]): React.ReactNode {
  if (respondents.length < 2) return null
  const insights: React.ReactNode[] = []

  // Highest CESD-R (depression)
  const sortedCesdr = [...respondents].filter(r => r.scores.cesdr !== null).sort((a, b) => (b.scores.cesdr ?? 0) - (a.scores.cesdr ?? 0))
  if (sortedCesdr.length > 0) {
    const top = sortedCesdr[0]
    insights.push(
      <p key="cesdr">
        💭 Gejala depresi tertinggi: <strong>{top.code}</strong> (CESD-R: {top.scores.cesdr})
      </p>
    )
  }

  // Best sleep quality (lowest PSQI)
  const sortedPsqi = [...respondents].filter(r => r.scores.psqi !== null).sort((a, b) => (a.scores.psqi ?? 99) - (b.scores.psqi ?? 99))
  if (sortedPsqi.length > 0) {
    const best = sortedPsqi[0]
    insights.push(
      <p key="psqi">
        😴 Kualitas tidur terbaik: <strong>{best.code}</strong> (PSQI: {best.scores.psqi})
      </p>
    )
  }

  // Highest social support
  const sortedMos = [...respondents].filter(r => r.scores.mos !== null).sort((a, b) => (b.scores.mos ?? 0) - (a.scores.mos ?? 0))
  if (sortedMos.length > 0) {
    const top = sortedMos[0]
    insights.push(
      <p key="mos">
        🤝 Dukungan sosial tertinggi: <strong>{top.code}</strong> (MOS: {top.scores.mos})
      </p>
    )
  }

  // Most bullied
  const sortedBl = [...respondents].filter(r => r.scores.bullying !== null).sort((a, b) => (b.scores.bullying ?? 0) - (a.scores.bullying ?? 0))
  if (sortedBl.length > 0 && (sortedBl[0].scores.bullying ?? 0) > 0) {
    const top = sortedBl[0]
    insights.push(
      <p key="bl">
        ⚠️ Pengalaman bullying tertinggi: <strong>{top.code}</strong> ({top.scores.bullying})
      </p>
    )
  }

  // High risk count
  const highRiskCount = respondents.filter(r => r.highRisk).length
  if (highRiskCount > 0) {
    insights.push(
      <p key="hr" className="font-semibold text-rose-600">
        ⚠️ {highRiskCount} dari {respondents.length} responden masuk kategori high risk
      </p>
    )
  }

  return insights
}
