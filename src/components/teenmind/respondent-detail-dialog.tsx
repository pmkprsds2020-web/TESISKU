'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Loader2, AlertTriangle, Clock, CheckCircle2, User, FileText, History, Printer } from 'lucide-react'

type Detail = {
  code: string
  school: string
  status: string
  currentStage: string
  stageIndex: number
  highRisk: boolean
  consentGiven: boolean
  startedAt: string
  completedAt: string | null
  demographic: Record<string, string>
  answers: {
    cesdr: Record<string, number>
    psqi: Record<string, string | number>
    screentime: Record<string, number>
    mos: Record<string, number>
    bullying: Record<string, number>
    religiosity: Record<string, number>
  }
  scores: {
    cesdr: number | null
    psqi: number | null
    mos: number | null
    bullying: number | null // GBS (item 1-4) saja
    climateSchool: number | null
    religiosity: number | null
  }
  cesdrItem18: number | null
  psqiBreakdown: {
    components: {
      c1_subjectiveQuality: number
      c2_sleepLatency: number
      c3_sleepDuration: number
      c4_sleepEfficiency: number
      c5_sleepDisturbance: number
      c6_sleepMedication: number
      c7_daytimeDysfunction: number
    }
    poorSleepQuality: boolean
    limitations: string[]
  } | null
  climateSchool: {
    total: number
    maxScore: number
    minScore: number
    category: string
    interpretation: string
    recommendation: string | null
  } | null
  screenTime: {
    total: number
    maxScore: number
    minScore: number
    highScreenTime: boolean
    category: string
    interpretation: string
    recommendation: string | null
  } | null
  analysis: {
    key: string
    label: string
    score: number | null
    maxScore: number
    category: string
    interpretation: string
    recommendation: string | null
    warn: boolean
  }[]
  conclusion: string[]
  clinicalNarrative: string
  recommendations: string[]
  auditLogs: { action: string; detail: string | null; createdAt: string }[]
}

const DEMO_LABELS: Record<string, string> = {
  initial: 'Inisial', age: 'Usia', gender: 'Jenis Kelamin', school: 'Sekolah',
  classGrade: 'Kelas', residence: 'Tempat Tinggal', parentIncome: 'Pendapatan Ortu',
  fatherEducation: 'Pendidikan Ayah', motherEducation: 'Pendidikan Ibu',
  familyComposition: 'Komposisi Keluarga', chronicIllness: 'Penyakit Kronis',
  mentalHistory: 'Riwayat Mental',
}

const CESDR_LABELS = ['Tidak Pernah', 'Kadang', 'Cukup Sering', 'Hampir Setiap Hari']
const MOS_LABELS = ['', 'Tidak Pernah', 'Jarang', 'Kadang', 'Sering', 'Selalu']
const BL_LABELS = ['Tidak Pernah', 'Sekali', 'Beberapa kali', 'Sering kali']
const CLIMATE_LABELS = ['', 'Sangat Setuju', 'Setuju', 'Tidak Setuju', 'Sangat Tidak Setuju']
const REL_LABELS = ['', 'Tidak Pernah', 'Jarang', 'Kadang', 'Sering', 'Selalu']
const ST_LABELS = ['Tidak Pernah', '< 1 jam', '1-2 jam', '3-4 jam', '> 4 jam']

const STAGE_LABELS: Record<string, string> = {
  consent: 'Persetujuan', demographics: 'Data Diri', cesdr: 'CESD-R',
  psqi: 'PSQI', screentime: 'Screen Time', mos: 'MOS-SSS',
  bullying: 'Bullying', religiosity: 'Religiusitas', complete: 'Selesai',
}

export function RespondentDetailDialog({
  code, open, onOpenChange,
}: {
  code: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !code) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setDetail(null)
      try {
        const r = await fetch(`/api/admin/respondent?code=${code}`)
        const d = await r.json()
        if (!cancelled && d.respondent) setDetail(d.respondent)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, code])

  function handlePrint(d: Detail) {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    const demoRows = Object.entries(DEMO_LABELS).map(
      ([k, label]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;font-size:12px">${label}</td><td style="padding:4px 0;font-size:12px;font-weight:600">${d.demographic[k] ?? '—'}</td></tr>`
    ).join('')

    const scoreRows = ([
      ['CESD-R (Depresi)', d.scores.cesdr, 60, d.scores.cesdr !== null && d.scores.cesdr >= 16],
      ['PSQI (Tidur)', d.scores.psqi, 21, d.scores.psqi !== null && d.scores.psqi > 5],
      ['MOS-SSS (Dukungan)', d.scores.mos, 50, d.scores.mos !== null && d.scores.mos <= 25],
      ['Bullying (GBS)', d.scores.bullying, 12, d.scores.bullying !== null && d.scores.bullying > 0],
      ['Climate School (Iklim Sekolah)', d.scores.climateSchool, 32, d.scores.climateSchool !== null && d.scores.climateSchool > 16],
      ['Religiusitas', d.scores.religiosity, 32, d.scores.religiosity !== null && d.scores.religiosity < 20],
    ] as const).map(([label, score, max, warn]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px">${label}</td>
        <td style="padding:6px;font-size:14px;font-weight:700;color:${warn ? '#dc2626' : '#0f172a'}">${score ?? '—'} / ${max}</td>
        <td style="padding:6px 0;font-size:11px;color:#888">${score !== null ? Math.round((score as number / (max as number)) * 100) + '%' : '—'}</td>
      </tr>
    `).join('')

    const analysisRows = d.analysis.map((a) => `
      <div class="analysis-item ${a.warn ? 'warn' : ''}">
        <div class="analysis-head">
          <span>${a.label}</span>
          <span class="analysis-score">${a.score ?? '—'} / ${a.maxScore}</span>
        </div>
        <p class="analysis-cat">${a.category}</p>
        <p class="analysis-text">${a.interpretation}</p>
        ${a.recommendation ? `<p class="analysis-rec">→ ${a.recommendation}</p>` : ''}
      </div>
    `).join('')

    const conclusionList = d.conclusion.length
      ? `<ul>${d.conclusion.map((l) => `<li>${l}</li>`).join('')}</ul>`
      : '<p style="font-size:12px;color:#94a3b8">Data belum lengkap.</p>'

    const recommendationList = d.recommendations.length
      ? `<ul>${d.recommendations.map((r) => `<li>${r}</li>`).join('')}</ul>`
      : '<p style="font-size:12px;color:#94a3b8">Tidak ada rekomendasi khusus berdasarkan hasil skrining saat ini.</p>'

    w.document.write(`<!DOCTYPE html><html><head><title>Laporan ${d.code}</title>
      <style>
        @page{size:A4 portrait;margin:16mm}
        *{box-sizing:border-box}
        body{font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px;color:#0f172a}
        h1{font-size:20px;margin:0 0 4px}
        h2{font-size:14px;margin:24px 0 8px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;break-after:avoid}
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #7dd3c0;padding-bottom:12px;margin-bottom:16px}
        .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600}
        .badge-risk{background:#fee2e2;color:#dc2626}
        .badge-done{background:#d1fae5;color:#059669}
        .badge-prog{background:#fef3c7;color:#d97706}
        table{width:100%;border-collapse:collapse}
        .scores{background:#f8fafc;border-radius:8px;padding:8px 16px;margin:8px 0}
        .warn-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:12px 0;font-size:12px;color:#991b1b}
        .section{break-inside:avoid-page}
        .analysis-item{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:11.5px;break-inside:avoid}
        .analysis-item.warn{border-color:#fecaca;background:#fef2f2}
        .analysis-head{display:flex;justify-content:space-between;font-weight:700;margin-bottom:2px}
        .analysis-score{color:#0f172a}
        .analysis-item.warn .analysis-score{color:#dc2626}
        .analysis-cat{margin:0 0 2px;font-weight:600;color:#475569}
        .analysis-text{margin:0 0 2px;color:#334155}
        .analysis-rec{margin:4px 0 0;font-weight:600;color:#b91c1c}
        .box{border-radius:8px;padding:12px 14px;margin:8px 0;font-size:12px;line-height:1.6}
        .box-conclusion{background:#f0f9ff;border:1px solid #bae6fd}
        .box-clinical{background:#f5f3ff;border:1px solid #ddd6fe}
        .box-rec{background:#f0fdf4;border:1px solid #bbf7d0}
        ul{margin:4px 0 0;padding-left:18px}
        li{margin-bottom:3px}
        .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
        @media print{body{padding:16mm}}
      </style>
    </head><body>
      <div class="header">
        <div>
          <h1>TeenMind Research — Laporan Responden</h1>
          <p style="font-size:13px;color:#64748b;margin:2px 0">Kode: <strong style="font-family:monospace">${d.code}</strong> · ${d.school || 'Sekolah tidak diketahui'}</p>
        </div>
        <div style="text-align:right">
          ${d.highRisk ? '<span class="badge badge-risk">⚠ HIGH RISK</span>' : ''}
          <span class="badge ${d.status === 'completed' ? 'badge-done' : 'badge-prog'}">${d.status === 'completed' ? '✓ Selesai' : '⏳ Proses'}</span>
        </div>
      </div>
      <p style="font-size:11px;color:#94a3b8;margin:0 0 16px">
        Kode Responden: <strong>${d.code}</strong> ·
        Tanggal Pemeriksaan: ${new Date(d.startedAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}
        ${d.completedAt ? ` · Tanggal Selesai: ${new Date(d.completedAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}` : ' · Belum selesai'}
        · Dokumen dibuat: ${new Date().toLocaleString('id-ID')}
      </p>
      ${d.highRisk ? `<div class="warn-box">
        <strong>⚠ PROSEDUR ETIK:</strong> Responden menandai item CESD-R #18 (menyakiti diri) dengan skor
        <strong>${d.cesdrItem18}</strong> (${CESDR_LABELS[d.cesdrItem18 ?? 0]}). Hubungi guru BK/konselor sekolah dalam 1×24 jam.
      </div>` : ''}

      <div class="section">
        <h2>1–2. Identitas &amp; Data Demografi</h2>
        <table>${demoRows}</table>
      </div>

      <div class="section">
        <h2>3. Skor Seluruh Instrumen</h2>
        <div class="scores"><table>${scoreRows}</table></div>
      </div>

      <div class="section">
        <h2>5. Analisis Hasil Skrining</h2>
        ${analysisRows}
      </div>

      <div class="section">
        <h2>6. Kesimpulan Skrining</h2>
        <div class="box box-conclusion">${conclusionList}</div>
      </div>

      <div class="section">
        <h2>7. Interpretasi Klinis</h2>
        <div class="box box-clinical"><p style="margin:0">${d.clinicalNarrative}</p></div>
      </div>

      <div class="section">
        <h2>8. Rekomendasi Tindak Lanjut</h2>
        <div class="box box-rec">${recommendationList}</div>
      </div>

      <div class="section">
        <h2>Catatan Penelitian</h2>
        <p style="font-size:11px;color:#64748b;line-height:1.5">
          Laporan ini bersifat rahasia dan hanya untuk keperluan penelitian &amp; tindak lanjut etik.
          CESD-R skor ≥16 menandakan gejala depresi bermakna. PSQI skor &gt;5 menandakan kualitas tidur buruk.
          MOS-SSS skor &gt;25 menandakan dukungan sosial tinggi. Climate School memakai kuesioner adaptasi
          8-item (bukan versi resmi 12-item); cutoff diskalakan secara proporsional — lihat lampiran metode.
        </p>
      </div>

      <div class="footer">TeenMind Research · Penelitian Tesis Faktor Biopsikososial Depresi Remaja SMP · Dokumen rahasia</div>
    </body></html>`)
    w.document.close()
    setTimeout(() => { w.print() }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-[95vw] max-w-2xl overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b bg-gradient-to-r from-violet-50 to-sky-50 px-6 py-4 dark:from-violet-950/30 dark:to-sky-950/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-white/10">
                <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <DialogTitle className="font-mono text-lg font-bold">
                  {code ?? '—'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {detail?.school || 'Sekolah tidak diketahui'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {detail?.highRisk && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> High Risk
                </Badge>
              )}
              {detail && (
                <Badge variant={detail.status === 'completed' ? 'default' : 'secondary'} className="gap-1">
                  {detail.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {detail.status === 'completed' ? 'Selesai' : 'Proses'}
                </Badge>
              )}
              {detail && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => handlePrint(detail)}
                >
                  <Printer className="h-3 w-3" /> PDF
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : detail ? (
            <div className="px-6 py-4">
              {/* Score summary */}
              <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-7">
                {([
                  ['CESD-R', detail.scores.cesdr, detail.scores.cesdr !== null && detail.scores.cesdr >= 16, 'from-rose-400 to-pink-400'],
                  ['PSQI', detail.scores.psqi, detail.scores.psqi !== null && detail.scores.psqi > 5, 'from-indigo-400 to-violet-400'],
                  ['MOS', detail.scores.mos, detail.scores.mos !== null && detail.scores.mos <= 25, 'from-amber-400 to-orange-400'],
                  ['GBS', detail.scores.bullying, detail.scores.bullying !== null && detail.scores.bullying > 0, 'from-orange-400 to-red-400'],
                  ['Climate', detail.scores.climateSchool, detail.scores.climateSchool !== null && detail.scores.climateSchool > 16, 'from-cyan-400 to-sky-500'],
                  ['Relig', detail.scores.religiosity, detail.scores.religiosity !== null && detail.scores.religiosity < 20, 'from-teal-400 to-emerald-400'],
                  ['Screen', detail.screenTime?.total ?? null, detail.screenTime ? detail.screenTime.category !== 'Dalam batas wajar' : false, 'from-violet-400 to-fuchsia-400'],
                ] as const).map(([label, score, warn, color]) => (
                  <div key={label} className={`rounded-xl bg-gradient-to-br ${color} p-2.5 text-center text-white shadow-sm ${warn ? 'ring-2 ring-rose-500 ring-offset-1' : ''}`}>
                    <p className="text-[10px] font-semibold opacity-90">{label}</p>
                    <p className="text-xl font-bold">{score ?? '—'}</p>
                  </div>
                ))}
              </div>

              {/* Radar chart — visual profile of scores (normalized 0-100) */}
              {detail.scores.cesdr !== null && (
                <div className="mb-5 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Profil Skor (Radar)</h4>
                    <span className="text-[10px] text-muted-foreground">Dinormalisasi 0–100</span>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={[
                        { name: 'Depresi', value: (detail.scores.cesdr ?? 0) / 60 * 100, raw: detail.scores.cesdr },
                        { name: 'Gangguan Tidur', value: (detail.scores.psqi ?? 0) / 21 * 100, raw: detail.scores.psqi },
                        { name: 'Dukungan Sosial', value: (detail.scores.mos ?? 0) / 50 * 100, raw: detail.scores.mos },
                        { name: 'Bullying (GBS)', value: (detail.scores.bullying ?? 0) / 12 * 100, raw: detail.scores.bullying },
                        { name: 'Iklim Sekolah', value: (detail.scores.climateSchool ?? 0) / 32 * 100, raw: detail.scores.climateSchool },
                        { name: 'Religiusitas', value: (detail.scores.religiosity ?? 0) / 32 * 100, raw: detail.scores.religiosity },
                      ]} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                        <PolarGrid stroke="oklch(0.8 0.02 220)" />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: 'oklch(0.5 0.02 250)' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'oklch(0.6 0.02 250)' }} tickCount={5} />
                        <Radar name="Skor" dataKey="value" stroke="#7dd3c0" fill="#7dd3c0" fillOpacity={0.4} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                    <span>🔴 Depresi & Tidur: lebih tinggi = lebih buruk</span>
                    <span>🟢 Dukungan & Religiusitas: lebih tinggi = lebih baik</span>
                  </div>
                </div>
              )}

              {detail.highRisk && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Responden ini menandai item CESD-R #18 (menyakiti diri) dengan
                    skor <strong>{detail.cesdrItem18}</strong> ({CESDR_LABELS[detail.cesdrItem18 ?? 0]}).
                    Hubungi guru BK sesuai prosedur etik.
                  </span>
                </div>
              )}

              <Tabs defaultValue="analysis" className="w-full">
                <TabsList className="mb-3 flex h-auto w-full flex-wrap gap-1 rounded-xl bg-muted/50 p-1">
                  <TabsTrigger value="analysis" className="rounded-lg text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-white/10">
                    Analisis
                  </TabsTrigger>
                  <TabsTrigger value="demo" className="rounded-lg text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-white/10">
                    <FileText className="mr-1 h-3.5 w-3.5" /> Demografi
                  </TabsTrigger>
                  <TabsTrigger value="answers" className="rounded-lg text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-white/10">
                    Jawaban
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="rounded-lg text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-white/10">
                    <History className="mr-1 h-3.5 w-3.5" /> Audit ({detail.auditLogs.length})
                  </TabsTrigger>
                </TabsList>

                {/* Analisis Hasil Skrining, Kesimpulan, Interpretasi Klinis, Rekomendasi */}
                <TabsContent value="analysis" className="mt-0 space-y-4">
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Analisis Hasil Skrining</h4>
                    <div className="space-y-2">
                      {detail.analysis.map((a) => (
                        <div
                          key={a.key}
                          className={`rounded-xl p-3 text-xs ${a.warn ? 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/20' : 'bg-muted/30'}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-semibold text-foreground">{a.label}</span>
                            <span className={`font-bold ${a.warn ? 'text-rose-600' : 'text-foreground'}`}>
                              {a.score ?? '—'} / {a.maxScore}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-muted-foreground">{a.category}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{a.interpretation}</p>
                          {a.recommendation && (
                            <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">→ {a.recommendation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {detail.conclusion.length > 0 && (
                    <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 dark:bg-sky-950/20">
                      <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Kesimpulan Skrining</h4>
                      <ul className="list-disc space-y-1 pl-4 text-[12px] text-foreground/90">
                        {detail.conclusion.map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:bg-violet-950/20">
                    <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Interpretasi Klinis</h4>
                    <p className="text-[12px] leading-relaxed text-foreground/90">{detail.clinicalNarrative}</p>
                  </div>

                  {detail.recommendations.length > 0 && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
                      <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Rekomendasi Tindak Lanjut</h4>
                      <ul className="list-disc space-y-1 pl-4 text-[12px] text-foreground/90">
                        {detail.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </TabsContent>

                {/* Demographics */}
                <TabsContent value="demo" className="mt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(DEMO_LABELS).map(([key, label]) => (
                      <div key={key} className="rounded-lg bg-muted/30 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium text-foreground">{detail.demographic[key] ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Answers */}
                <TabsContent value="answers" className="mt-0 space-y-4">
                  <AnswerSection title="CESD-R (20 item)" items={
                    Object.entries(detail.answers.cesdr)
                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                      .map(([k, v]) => [`Item ${k}`, CESDR_LABELS[v] ?? v, Number(k) === 18])
                  } />
                  <AnswerSection title="PSQI (Tidur)" items={
                    Object.entries(detail.answers.psqi).map(([k, v]) => [k, String(v), false])
                  } />
                  {detail.psqiBreakdown && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:bg-indigo-950/20">
                      <p className="mb-2 text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">
                        Breakdown Komponen PSQI (C1–C7)
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ['C1 Kualitas', detail.psqiBreakdown.components.c1_subjectiveQuality],
                          ['C2 Latensi', detail.psqiBreakdown.components.c2_sleepLatency],
                          ['C3 Durasi', detail.psqiBreakdown.components.c3_sleepDuration],
                          ['C4 Efisiensi', detail.psqiBreakdown.components.c4_sleepEfficiency],
                          ['C5 Gangguan', detail.psqiBreakdown.components.c5_sleepDisturbance],
                          ['C6 Obat Tidur', detail.psqiBreakdown.components.c6_sleepMedication],
                          ['C7 Disfungsi', detail.psqiBreakdown.components.c7_daytimeDysfunction],
                        ].map(([label, val]) => (
                          <div key={label as string} className="rounded-lg bg-white px-2 py-1.5 text-center dark:bg-white/10">
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{val}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {detail.psqiBreakdown.poorSleepQuality ? 'Kualitas tidur buruk (skor global > 5).' : 'Kualitas tidur baik (skor global ≤ 5).'}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                          Keterbatasan pengukuran (kuesioner adaptasi, bukan PSQI 19-item resmi)
                        </summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                          {detail.psqiBreakdown.limitations.map((l, i) => <li key={i}>{l}</li>)}
                        </ul>
                      </details>
                    </div>
                  )}
                  <AnswerSection title="Screen Time & Medsos" items={
                    Object.entries(detail.answers.screentime).map(([k, v]) => [k, ST_LABELS[v] ?? v, false])
                  } />
                  {detail.screenTime && (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:bg-violet-950/20">
                      <p className="text-[11px] text-muted-foreground">
                        Skor Screen Time (deskriptif, bukan skala baku): <strong>{detail.screenTime.total} / {detail.screenTime.maxScore}</strong> — {detail.screenTime.category}
                      </p>
                    </div>
                  )}
                  <AnswerSection title="MOS-SSS (Dukungan)" items={
                    Object.entries(detail.answers.mos).map(([k, v]) => [`Item ${k}`, MOS_LABELS[v] ?? v, false])
                  } />
                  <AnswerSection title="GBS — Pengalaman Perundungan (item 1-4)" items={
                    Object.entries(detail.answers.bullying)
                      .filter(([k]) => Number(k) <= 4)
                      .map(([k, v]) => [`Item ${k}`, BL_LABELS[v] ?? v, Number(v) > 0])
                  } />
                  <AnswerSection title="Climate School — Iklim Sekolah (item 5-12)" items={
                    Object.entries(detail.answers.bullying)
                      .filter(([k]) => Number(k) >= 5)
                      .map(([k, v]) => [`Item ${k}`, CLIMATE_LABELS[Number(v)] ?? v, false])
                  } />
                  {detail.climateSchool && (
                    <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-3 dark:bg-cyan-950/20">
                      <p className="text-[11px] text-muted-foreground">
                        Skor Climate School: <strong>{detail.climateSchool.total} / {detail.climateSchool.maxScore}</strong> — {detail.climateSchool.category}
                      </p>
                    </div>
                  )}
                  <AnswerSection title="Religiusitas" items={
                    Object.entries(detail.answers.religiosity).map(([k, v]) => [`Item ${k}`, REL_LABELS[v] ?? v, false])
                  } />
                </TabsContent>

                {/* Audit log */}
                <TabsContent value="audit" className="mt-0">
                  {detail.auditLogs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada log.</p>
                  ) : (
                    <StageTimeline
                      logs={detail.auditLogs}
                      startedAt={detail.startedAt}
                      completedAt={detail.completedAt}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <p className="py-20 text-center text-sm text-muted-foreground">Gagal memuat data.</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function AnswerSection({ title, items }: { title: string; items: [string, string | number, boolean][] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {items.map(([label, value, warn], i) => (
          <div
            key={i}
            className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs ${
              warn
                ? 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/30'
                : 'bg-muted/30'
            }`}
          >
            <span className="text-muted-foreground">{label}</span>
            <span className={`font-semibold ${warn ? 'text-rose-600' : 'text-foreground'}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StageTimeline({
  logs, startedAt, completedAt,
}: {
  logs: { action: string; detail: string | null; createdAt: string }[]
  startedAt: string
  completedAt: string | null
}) {
  // Extract stage_complete events to build the timeline
  const stageEvents = logs.filter(l => l.action === 'stage_complete' || l.action === 'complete' || l.action === 'login' || l.action === 'high_risk_flag')
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const totalDuration = end - start

  const STAGE_META: Record<string, { label: string; icon: string; color: string }> = {
    login: { label: 'Login', icon: '🔑', color: 'bg-sky-500' },
    consent: { label: 'Persetujuan', icon: '📋', color: 'bg-violet-500' },
    demographics: { label: 'Data Diri', icon: '👤', color: 'bg-sky-500' },
    cesdr: { label: 'CESD-R', icon: '💭', color: 'bg-rose-500' },
    psqi: { label: 'PSQI', icon: '😴', color: 'bg-indigo-500' },
    screentime: { label: 'Screen Time', icon: '📱', color: 'bg-emerald-500' },
    mos: { label: 'MOS-SSS', icon: '🤝', color: 'bg-amber-500' },
    bullying: { label: 'Bullying', icon: '🏫', color: 'bg-orange-500' },
    religiosity: { label: 'Religiusitas', icon: '🕌', color: 'bg-teal-500' },
    complete: { label: 'Selesai', icon: '🎉', color: 'bg-emerald-600' },
  }

  function formatDuration(ms: number) {
    if (ms < 60000) return `${Math.round(ms / 1000)}d`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000 * 10) / 10}j`
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50 p-4 dark:from-sky-950/20 dark:to-emerald-950/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Total Durasi</p>
            <p className="text-2xl font-bold text-foreground">{formatDuration(totalDuration)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Mulai</p>
            <p className="text-xs font-medium text-foreground">{new Date(startedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
            {completedAt && (
              <>
                <p className="mt-1 text-xs text-muted-foreground">Selesai</p>
                <p className="text-xs font-medium text-foreground">{new Date(completedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Proportional timeline bar */}
      {stageEvents.length > 1 && (
        <div className="rounded-2xl bg-muted/30 p-4">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Linimasa Bagian</h4>
          <div className="flex h-8 w-full overflow-hidden rounded-lg">
            {stageEvents.map((ev, i) => {
              const next = stageEvents[i + 1]
              const cur = new Date(ev.createdAt).getTime()
              const nxt = next ? new Date(next.createdAt).getTime() : end
              const dur = nxt - cur
              const pct = (dur / totalDuration) * 100
              if (pct <= 0) return null
              const detail = ev.detail || ''
              const stageKey = detail.includes('consent') ? 'consent' : detail.includes('demographics') ? 'demographics' : detail.includes('cesdr') ? 'cesdr' : detail.includes('psqi') ? 'psqi' : detail.includes('screentime') ? 'screentime' : detail.includes('mos') ? 'mos' : detail.includes('bullying') ? 'bullying' : detail.includes('religiosity') ? 'religiosity' : detail.includes('complete') ? 'complete' : ev.action
              const meta = STAGE_META[stageKey] ?? { label: ev.action, icon: '•', color: 'bg-slate-400' }
              return (
                <div
                  key={i}
                  className={`group relative flex items-center justify-center ${meta.color} transition-all hover:brightness-110`}
                  style={{ width: `${pct}%`, minWidth: '2px' }}
                  title={`${meta.label}: ${formatDuration(dur)}`}
                >
                  <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    {pct > 8 ? meta.icon : ''}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(STAGE_META).filter(([k]) => stageEvents.some(e => (e.detail || e.action).includes(k))).map(([k, meta]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={`h-2 w-2 rounded-sm ${meta.color}`} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Detailed log timeline */}
      <div>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Log Detail</h4>
        <div className="relative space-y-2.5 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
          {logs.map((log, i) => {
            const isStage = log.action === 'stage_complete' || log.action === 'complete'
            const isHighRisk = log.action === 'high_risk_flag'
            const detail = log.detail || ''
            const stageKey = detail.includes('consent') ? 'consent' : detail.includes('demographics') ? 'demographics' : detail.includes('cesdr') ? 'cesdr' : detail.includes('psqi') ? 'psqi' : detail.includes('screentime') ? 'screentime' : detail.includes('mos') ? 'mos' : detail.includes('bullying') ? 'bullying' : detail.includes('religiosity') ? 'religiosity' : 'complete'
            const meta = STAGE_META[stageKey]
            return (
              <div key={i} className="relative flex gap-3 pl-6">
                <div className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${
                  isHighRisk ? 'bg-rose-500' : isStage && meta ? meta.color : 'bg-primary'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {meta && isStage ? `${meta.icon} ${meta.label}` : log.action}
                  </p>
                  {log.detail && <p className="text-xs text-muted-foreground">{log.detail}</p>}
                  <p className="text-[10px] text-muted-foreground/70">
                    {new Date(log.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
