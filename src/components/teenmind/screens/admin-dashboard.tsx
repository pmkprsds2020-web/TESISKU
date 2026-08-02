'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import {
  Users, CheckCircle2, Clock, AlertTriangle, Target, TrendingUp,
  Download, LogOut, Sparkles, Loader2, FileSpreadsheet, FileJson,
  Brain, ArrowLeft, Activity, Database, Hash, QrCode, ShieldAlert, Search, Settings, GitCompare, BarChart3, Printer, FlaskConical,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { ThemeToggle } from '@/components/teenmind/theme-toggle'
import { RespondentDetailDialog } from '@/components/teenmind/respondent-detail-dialog'
import { CompareDialog } from '@/components/teenmind/compare-dialog'
import { CodesPanel } from '@/components/teenmind/codes-panel'
import { SettingsPanel } from '@/components/teenmind/settings-panel'
import { Skeleton } from '@/components/ui/skeleton'

// PERF (audit finding): CohortPanel alone statically imports 9 heavy
// statistics panels (crosstab, regression, logistic, reliability, factor,
// cluster, mediation, moderation, partial-corr) which together with
// recharts made up a large chunk of the admin bundle — loaded immediately
// whenever ANY admin tab opened, even if "Cohort" was never clicked.
// Loading it lazily means that weight is only fetched when the researcher
// actually opens the Cohort/Advanced Stats tab.
const CohortPanel = dynamic(
  () => import('@/components/teenmind/cohort-panel').then((m) => m.CohortPanel),
  {
    loading: () => (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    ),
  }
)

type Stats = {
  overview: {
    totalCodes: number
    totalRespondents: number
    completed: number
    inProgress: number
    highRisk: number
    targetRespondents?: number
    completionRate: number
    targetProgress?: number
  }
  perDay: { date: string; total: number; completed: number }[]
  distribution: {
    bySchool: { label: string; value: number }[]
    byGender: { label: string; value: number }[]
    byAge: { label: string; value: number }[]
    byClass: { label: string; value: number }[]
  }
  descriptive: {
    cesdr: { n: number; mean: number; median: number; sd: number; min: number; max: number }
    psqi: { n: number; mean: number; median: number; sd: number; min: number; max: number }
    mos: { n: number; mean: number; median: number; sd: number; min: number; max: number }
    bullying: { n: number; mean: number; median: number; sd: number; min: number; max: number }
    religiosity: { n: number; mean: number; median: number; sd: number; min: number; max: number }
  }
  correlations: Record<string, number> & { matrix?: Record<string, Record<string, number>> }
  n: number
}

type Respondent = {
  code: string
  school: string
  status: string
  highRisk: boolean
  startedAt: string
  completedAt: string | null
  demographic: Record<string, string>
  scores: {
    cesdr: number | null
    psqi: number | null
    mos: number | null
    bullying: number | null
    religiosity: number | null
  }
  cesdrItem18: number | null
}

const CHART_COLORS = ['#7dd3c0', '#a5b4fc', '#fcd34d', '#f9a8d4', '#86efac', '#7dd3fc', '#fdba74']

export function AdminDashboard() {
  const setMode = useAppStore((s) => s.setMode)
  const [stats, setStats] = useState<Stats | null>(null)
  const [respondents, setRespondents] = useState<Respondent[]>([])
  const [loading, setLoading] = useState(true)
  const [aiNarrative, setAiNarrative] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [detailCode, setDetailCode] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [respSearch, setRespSearch] = useState('')
  const [respFilter, setRespFilter] = useState<'all' | 'highrisk' | 'completed' | 'progress'>('all')
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        fetch('/api/admin/stats').then((x) => x.json()),
        fetch('/api/admin/respondents').then((x) => x.json()),
      ])
      if (!s.error) setStats(s)
      if (!r.error) setRespondents(r.respondents)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleLogout() {
    await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => {})
    setMode('welcome')
  }

  async function handleExport(format: 'csv' | 'json' | 'sav') {
    if (format === 'sav') {
      // Real .sav uses Python pyreadstat via separate endpoint
      window.location.href = '/api/admin/export-sav'
    } else {
      window.location.href = `/api/admin/export?format=${format}`
    }
  }

  async function handleAiAnalytics() {
    setAiLoading(true)
    setAiError(null)
    setAiNarrative('')
    try {
      const res = await fetch('/api/admin/ai-analytics', { method: 'POST' })
      const contentType = res.headers.get('content-type') ?? ''

      // Streaming path: read plain-text chunks as they arrive so the
      // narrative renders progressively instead of waiting for the whole
      // generation to finish.
      if (contentType.includes('text/plain') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        // First chunk arriving flips us out of the "generating" skeleton.
        let receivedAny = false
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          if (chunk) {
            if (!receivedAny) {
              receivedAny = true
              setAiLoading(false)
            }
            setAiNarrative((prev) => (prev ?? '') + chunk)
          }
        }
        if (!receivedAny) {
          setAiNarrative('Tidak dapat menghasilkan ringkasan AI saat ini.')
        }
      } else {
        // Fallback: server returned a plain JSON response (non-streamed).
        const data = await res.json()
        setAiNarrative(data.narrative)
      }
    } catch {
      setAiError('Gagal menghubungi layanan AI.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="min-h-[100dvh] bg-mesh">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
          <Skeleton className="mt-4 h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  const o = stats.overview

  // Filtered respondents for table
  const filteredRespondents = respondents.filter((r) => {
    if (respSearch) {
      const q = respSearch.toLowerCase()
      if (!r.code.toLowerCase().includes(q) && !(r.school ?? '').toLowerCase().includes(q)) return false
    }
    if (respFilter === 'completed' && r.status !== 'completed') return false
    if (respFilter === 'progress' && r.status !== 'in_progress') return false
    if (respFilter === 'highrisk' && !r.highRisk) return false
    return true
  })

  const highRiskRespondents = respondents.filter((r) => r.highRisk)

  return (
    <div className="min-h-[100dvh] bg-mesh">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-black/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-400 text-white shadow">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Panel Peneliti</p>
              <p className="text-[11px] text-muted-foreground">TeenMind Research Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => setMode('welcome')} className="text-xs">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Beranda
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
              <LogOut className="mr-1 h-3.5 w-3.5" /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 flex h-auto w-full gap-1 overflow-x-auto rounded-2xl bg-white/70 p-1.5 shadow-sm ring-1 ring-black/5 scrollbar-thin dark:bg-white/5">
            <TabsTrigger value="overview" className="flex-shrink-0 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="mr-1.5 h-4 w-4" /> Ringkasan
            </TabsTrigger>
            <TabsTrigger value="respondents" className="flex-shrink-0 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="mr-1.5 h-4 w-4" /> Responden
            </TabsTrigger>
            <TabsTrigger value="highrisk" className="flex-shrink-0 rounded-xl data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <ShieldAlert className="mr-1.5 h-4 w-4" /> High Risk
              {o.highRisk > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white data-[state=active]:bg-white/30">
                  {o.highRisk}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="codes" className="flex-shrink-0 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <QrCode className="mr-1.5 h-4 w-4" /> Kode
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex-shrink-0 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Brain className="mr-1.5 h-4 w-4" /> AI Analytics
            </TabsTrigger>
            <TabsTrigger value="cohort" className="flex-shrink-0 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FlaskConical className="mr-1.5 h-4 w-4" /> Kohort
            </TabsTrigger>
            <TabsTrigger value="export" className="flex-shrink-0 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Download className="mr-1.5 h-4 w-4" /> Export
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="mr-1.5 h-4 w-4" /> Pengaturan
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            {/* Target progress banner */}
            {o.targetRespondents && o.targetRespondents > 0 && (
              <Card className="overflow-hidden p-0">
                <div className="relative bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 p-5 text-white">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Progres Target Penelitian</p>
                      <p className="mt-1 text-2xl font-bold">
                        {o.completed} <span className="text-white/70">/ {o.targetRespondents}</span>
                        <span className="ml-2 text-sm font-medium text-white/90">responden selesai</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-extrabold">{o.targetProgress ?? 0}%</p>
                      <p className="text-xs text-white/80">dari target</p>
                    </div>
                  </div>
                  <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/25">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, o.targetProgress ?? 0)}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={Users} label="Total Responden" value={o.totalRespondents} color="from-sky-400 to-blue-400" />
              <StatCard icon={Target} label="Kode Dibuat" value={o.totalCodes} color="from-violet-400 to-purple-400" />
              <StatCard icon={CheckCircle2} label="Selesai" value={o.completed} color="from-emerald-400 to-teal-400" />
              <StatCard icon={Clock} label="Sedang Isi" value={o.inProgress} color="from-amber-400 to-orange-400" />
              <StatCard icon={AlertTriangle} label="High Risk" value={o.highRisk} color="from-rose-400 to-red-400" pulse={o.highRisk > 0} />
              <StatCard icon={TrendingUp} label="Completion Rate" value={`${o.completionRate}%`} color="from-cyan-400 to-sky-400" />
            </div>

            {/* Per day chart */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground">Respon per Hari</h3>
                  <p className="text-xs text-muted-foreground">14 hari terakhir</p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="h-3 w-3" /> {o.totalRespondents} total
                </Badge>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.perDay} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid oklch(0.9 0.02 220)', fontSize: 12 }} formatter={(v: number) => [v, '']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" stroke="#7dd3c0" strokeWidth={2.5} name="Mulai" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="completed" stroke="#a5b4fc" strokeWidth={2.5} name="Selesai" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Distribution charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 font-bold text-foreground">Per Sekolah</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.distribution.bySchool} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'oklch(0.96 0.02 220)' }} />
                      <Bar dataKey="value" fill="#7dd3c0" radius={[0, 8, 8, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="mb-4 font-bold text-foreground">Jenis Kelamin</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.distribution.byGender} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={75} label={(e) => `${e.label}: ${e.value}`} labelLine={false}>
                        {stats.distribution.byGender.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="mb-4 font-bold text-foreground">Per Usia</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.distribution.byAge} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'oklch(0.96 0.02 220)' }} />
                      <Bar dataKey="value" fill="#a5b4fc" radius={[8, 8, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="mb-4 font-bold text-foreground">Per Kelas</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.distribution.byClass} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'oklch(0.96 0.02 220)' }} />
                      <Bar dataKey="value" fill="#fcd34d" radius={[8, 8, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Descriptive stats */}
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Statistik Deskriptif</h3>
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-semibold">Instrumen</th>
                      <th className="px-3 py-2 font-semibold">N</th>
                      <th className="px-3 py-2 font-semibold">Mean</th>
                      <th className="px-3 py-2 font-semibold">Median</th>
                      <th className="px-3 py-2 font-semibold">SD</th>
                      <th className="px-3 py-2 font-semibold">Min</th>
                      <th className="px-3 py-2 font-semibold">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['CESD-R', stats.descriptive.cesdr],
                      ['PSQI', stats.descriptive.psqi],
                      ['MOS-SSS', stats.descriptive.mos],
                      ['Bullying', stats.descriptive.bullying],
                      ['Religiusitas', stats.descriptive.religiosity],
                    ].map(([name, d]) => {
                      const x = d as Stats['descriptive']['cesdr']
                      return (
                        <tr key={name as string} className="border-b last:border-0">
                          <td className="py-2.5 pr-4 font-medium text-foreground">{name as string}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{x.n}</td>
                          <td className="px-3 py-2.5 font-semibold text-foreground">{x.mean}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{x.median}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{x.sd}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{x.min}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{x.max}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Score Distribution Histograms */}
            <ScoreDistribution respondents={respondents} />

            {/* Correlations */}
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Korelasi dengan CESD-R (Depresi)</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['CESD-R ↔ PSQI (Tidur)', stats.correlations.cesdr_psqi],
                  ['CESD-R ↔ MOS (Dukungan)', stats.correlations.cesdr_mos],
                  ['CESD-R ↔ Bullying', stats.correlations.cesdr_bullying],
                  ['CESD-R ↔ Religiusitas', stats.correlations.cesdr_religiosity],
                ].map(([label, val]) => {
                  const v = val as number
                  const strength = Math.abs(v) < 0.1 ? 'Sangat lemah' : Math.abs(v) < 0.3 ? 'Lemah' : Math.abs(v) < 0.5 ? 'Sedang' : 'Kuat'
                  const dir = v > 0 ? 'positif' : v < 0 ? 'negatif' : 'tidak ada'
                  const color = v > 0 ? 'text-rose-600' : v < 0 ? 'text-emerald-600' : 'text-muted-foreground'
                  return (
                    <div key={label as string} className="rounded-2xl bg-muted/40 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{label as string}</p>
                      <p className={`mt-1 text-2xl font-bold ${color}`}>{v}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Korelasi {strength} ({dir})
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Correlation matrix heatmap */}
              {stats.correlations.matrix && (
                <div className="mt-5 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 ring-1 ring-black/5 dark:ring-white/5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Matriks Korelasi (Heatmap)
                    </h4>
                    <span className="text-[10px] text-muted-foreground">Pearson r · hover untuk detail</span>
                  </div>
                  <div className="flex justify-center">
                    <CorrelationHeatmap matrix={stats.correlations.matrix} />
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* RESPONDENTS */}
          <TabsContent value="respondents">
            <Card className="p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold text-foreground">Daftar Responden</h3>
                  <p className="text-xs text-muted-foreground">
                    {filteredRespondents.length} dari {respondents.length} responden
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={respSearch}
                      onChange={(e) => setRespSearch(e.target.value)}
                      placeholder="Cari kode/sekolah..."
                      className="h-9 rounded-xl pl-9 sm:w-48"
                    />
                  </div>
                  <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
                    {([['all', 'Semua'], ['completed', 'Selesai'], ['progress', 'Proses'], ['highrisk', 'Risiko']] as const).map(([f, label]) => (
                      <button
                        key={f}
                        onClick={() => setRespFilter(f)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          respFilter === f ? 'bg-white text-foreground shadow-sm dark:bg-white/10' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant={selectedForCompare.size >= 2 ? 'default' : 'outline'}
                    onClick={() => setCompareOpen(true)}
                    disabled={selectedForCompare.size < 2}
                    className="h-9 gap-1.5 rounded-xl"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Bandingkan
                    {selectedForCompare.size > 0 && (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/30 px-1 text-[10px] font-bold">
                        {selectedForCompare.size}
                      </span>
                    )}
                  </Button>
                  {selectedForCompare.size > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedForCompare(new Set())}
                      className="h-9 rounded-xl text-xs"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[65vh] rounded-2xl">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-card">
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="w-8 py-2 pr-1 font-semibold">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 cursor-pointer rounded accent-primary"
                            checked={filteredRespondents.length > 0 && filteredRespondents.every(r => selectedForCompare.has(r.code))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedForCompare(new Set(filteredRespondents.slice(0, 6).map(r => r.code)))
                              } else {
                                setSelectedForCompare(new Set())
                              }
                            }}
                            title="Pilih semua (maks 6)"
                          />
                        </th>
                        <th className="py-2 pr-3 font-semibold">Kode</th>
                        <th className="px-3 py-2 font-semibold">Sekolah</th>
                        <th className="px-3 py-2 font-semibold">JK</th>
                        <th className="px-3 py-2 font-semibold">Usia</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">CESD-R</th>
                        <th className="px-3 py-2 font-semibold">PSQI</th>
                        <th className="px-3 py-2 font-semibold">MOS</th>
                        <th className="px-3 py-2 font-semibold">Bully</th>
                        <th className="px-3 py-2 font-semibold">Relig</th>
                        <th className="px-3 py-2 font-semibold">Risiko</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRespondents.map((r) => {
                        const isSelected = selectedForCompare.has(r.code)
                        return (
                        <tr
                          key={r.code}
                          onClick={() => { setDetailCode(r.code); setDetailOpen(true) }}
                          className={`cursor-pointer border-b last:border-0 transition-colors hover:bg-primary/5 ${isSelected ? 'bg-violet-50/50 dark:bg-violet-950/20' : ''}`}
                        >
                          <td className="py-2.5 pr-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 cursor-pointer rounded accent-violet-500"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedForCompare((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) {
                                    if (next.size < 6) next.add(r.code)
                                  } else {
                                    next.delete(r.code)
                                  }
                                  return next
                                })
                              }}
                              disabled={!isSelected && selectedForCompare.size >= 6}
                              title={isSelected ? 'Hapus dari perbandingan' : selectedForCompare.size >= 6 ? 'Maksimal 6 responden' : 'Tambah ke perbandingan'}
                            />
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-foreground">{r.code}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.school || '-'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.demographic?.gender?.[0]?.toUpperCase() ?? '-'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.demographic?.age ?? '-'}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant={r.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                              {r.status === 'completed' ? 'Selesai' : 'Proses'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <ScoreCell value={r.scores.cesdr} max={60} threshold={16} color="rose" />
                          </td>
                          <td className="px-3 py-2.5"><ScoreCell value={r.scores.psqi} max={21} threshold={5} color="indigo" /></td>
                          <td className="px-3 py-2.5"><ScoreCell value={r.scores.mos} max={40} color="amber" /></td>
                          <td className="px-3 py-2.5"><ScoreCell value={r.scores.bullying} max={24} threshold={8} color="orange" /></td>
                          <td className="px-3 py-2.5"><ScoreCell value={r.scores.religiosity} max={40} color="teal" /></td>
                          <td className="px-3 py-2.5">
                            {r.highRisk ? (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertTriangle className="h-3 w-3" /> Tinggi
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                💡 Klik baris untuk detail · Centang untuk bandingkan (maks 6)
              </p>
            </Card>
          </TabsContent>

          {/* HIGH RISK */}
          <TabsContent value="highrisk">
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-red-400 text-white shadow-lg">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Responden High Risk</h3>
                  <p className="text-xs text-muted-foreground">
                    CESD-R item #18 (menyakiti diri) ≥ "Cukup Sering" — perlu tindak lanjut
                  </p>
                </div>
              </div>
              {highRiskRespondents.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                  <p className="mt-3 text-sm font-medium text-foreground">Tidak ada responden high risk</p>
                  <p className="text-xs text-muted-foreground">Semua responden dalam kondisi baik</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {highRiskRespondents.map((r) => (
                    <div
                      key={r.code}
                      onClick={() => { setDetailCode(r.code); setDetailOpen(true) }}
                      className="group cursor-pointer rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 transition-all hover:shadow-md hover:border-rose-300 dark:from-rose-950/20 dark:to-transparent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-sm font-bold text-foreground">{r.code}</p>
                          <p className="text-xs text-muted-foreground">{r.school || '—'}</p>
                        </div>
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Item 18: {r.cesdrItem18 ?? '?'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          {r.demographic?.gender === 'perempuan' ? '👩' : '👨'} {r.demographic?.age ?? '?'} thn
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold text-rose-600">CESD-R: {r.scores.cesdr ?? '?'}</span>
                      </div>
                      {r.completedAt && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Selesai: {new Date(r.completedAt).toLocaleDateString('id-ID')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>📋 Prosedur Etik:</strong> Hubungi guru BK/konselor sekolah untuk
                responden high risk dalam 1×24 jam sesuai protokol penelitian.
              </div>
            </Card>
          </TabsContent>

          {/* CODES */}
          <TabsContent value="codes">
            <CodesPanel />
          </TabsContent>

          {/* AI ANALYTICS */}
          <TabsContent value="ai">
            <Card className="p-5">
              <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-400 text-white shadow-lg">
                    <Brain className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">AI Analytics — Ringkasan Naratif</h3>
                    <p className="text-xs text-muted-foreground">Ringkasan analitis siap Bab IV tesis</p>
                  </div>
                </div>
                <Button
                  onClick={handleAiAnalytics}
                  disabled={aiLoading}
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg hover:from-violet-600 hover:to-indigo-600"
                >
                  {aiLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menganalisis...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Ringkasan</>}
                </Button>
              </div>

              {aiError && (
                <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600 ring-1 ring-rose-100">{aiError}</div>
              )}

              {aiNarrative ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-gradient-to-br from-violet-50/80 to-indigo-50/40 p-5 ring-1 ring-violet-100"
                >
                  <div className="mb-3 flex items-center gap-2 border-b border-violet-100 pb-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="text-xs font-bold uppercase tracking-wide text-violet-600">Ringkasan Bab IV — Siap Tesis</span>
                  </div>
                  <div className="teenmind-prose max-w-none text-sm leading-relaxed text-foreground/90 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-violet-700 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_strong]:text-foreground">
                    <ReactMarkdown>{aiNarrative}</ReactMarkdown>
                  </div>
                  <div className="mt-4 flex justify-end gap-2 border-t border-violet-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const blob = new Blob([aiNarrative], { type: 'text/markdown' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'teenmind_bab4_ringkasan.md'
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Unduh .md
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => navigator.clipboard.writeText(aiNarrative)}
                    >
                      <FileJson className="mr-1.5 h-3.5 w-3.5" /> Salin
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const w = window.open('', '_blank', 'width=900,height=700')
                        if (!w) return
                        const html = aiNarrative
                          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                          .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;color:#6d28d9;margin:16px 0 6px;font-weight:700">$1</h3>')
                          .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;color:#1e293b;margin:20px 0 8px;font-weight:700;border-bottom:2px solid #e9d5ff;padding-bottom:4px">$1</h2>')
                          .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;color:#0f172a;margin:0 0 12px;font-weight:800">$1</h1>')
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.7;font-size:13px">')
                          .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0 4px 20px;font-size:13px">$1</li>')
                          .replace(/^- (.+)$/gm, '<li style="margin:4px 0 4px 20px;font-size:13px;list-style:disc">$1</li>')
                        w.document.write(`<!DOCTYPE html><html><head><title>Bab IV - Ringkasan AI</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:40px;color:#1e293b;line-height:1.6}.header{text-align:center;border-bottom:3px solid #7dd3c0;padding-bottom:16px;margin-bottom:24px}h1{color:#0f172a}.footer{margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}@media print{body{padding:16mm}}</style></head><body>
                          <div class="header"><h1>TeenMind Research</h1><p style="color:#64748b;font-size:13px">Bab IV — Hasil dan Pembahasan (Ringkasan AI)</p><p style="color:#94a3b8;font-size:11px;margin-top:4px">Dibuat: ${new Date().toLocaleString('id-ID')}</p></div>
                          <div>${html}</div>
                          <div class="footer">TeenMind Research · Dokumen otomatis dari AI Analytics · Periksa dan validasi sebelum dimasukkan ke tesis</div>
                        </body></html>`)
                        w.document.close()
                        setTimeout(() => w.print(), 300)
                      }}
                    >
                      <Printer className="mr-1.5 h-3.5 w-3.5" /> PDF
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-black/10 p-10 text-center">
                  <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Klik <strong>Generate Ringkasan</strong> untuk menghasilkan narasi analitis otomatis dari data penelitian.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Mencakup: gambaran responden, statistik deskriptif, interpretasi CESD-R, korelasi, faktor dominan, & rekomendasi.
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* COHORT */}
          <TabsContent value="cohort">
            <CohortPanel />
          </TabsContent>

          {/* EXPORT */}
          <TabsContent value="export">
            <Card className="p-5">
              <h3 className="mb-1 font-bold text-foreground">Export Data</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Unduh seluruh data responden beserta skor instrumen untuk analisis lanjutan.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <ExportCard
                  icon={FileSpreadsheet}
                  title="Excel / CSV"
                  desc="Format spreadsheet universal. Bisa dibuka di Excel, Google Sheets, LibreOffice."
                  color="from-emerald-400 to-teal-400"
                  onClick={() => handleExport('csv')}
                />
                <ExportCard
                  icon={FileJson}
                  title="JSON"
                  desc="Format terstruktur untuk integrasi API atau analisis Python/R."
                  color="from-sky-400 to-indigo-400"
                  onClick={() => handleExport('json')}
                />
                <ExportCard
                  icon={Database}
                  title="SPSS (.sav)"
                  desc="File .sav biner asli dengan variable labels — langsung buka di SPSS."
                  color="from-violet-400 to-purple-400"
                  onClick={() => handleExport('sav')}
                />
              </div>

              <div className="mt-6 rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Catatan Etik & Privasi:</p>
                <p className="mt-1">
                  Data diekspor dalam bentuk anonim (tanpa nama lengkap). Identitas responden hanya direpresentasikan
                  oleh kode penelitian. Pastikan akses file export dibatasi sesuai prosedur etik penelitian.
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-black/5 bg-white/60 py-4 text-center backdrop-blur dark:bg-white/5">
        <p className="text-xs text-muted-foreground">
          TeenMind Research · Dashboard Peneliti · Data terenkripsi & diaudit
        </p>
      </footer>

      <RespondentDetailDialog
        code={detailCode}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <CompareDialog
        codes={Array.from(selectedForCompare)}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, pulse }: { icon: React.ElementType; label: string; value: number | string; color: string; pulse?: boolean }) {
  return (
    <Card className={`relative overflow-hidden p-4 ${pulse ? 'ring-2 ring-rose-300' : ''}`}>
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${color} opacity-20 blur-xl`} />
      <div className="relative">
        <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-white shadow`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}

function ExportCard({ icon: Icon, title, desc, color, onClick }: { icon: React.ElementType; title: string; desc: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-bold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
        <Download className="h-3.5 w-3.5" /> Download
      </span>
    </button>
  )
}

function ScoreDistribution({ respondents }: { respondents: Respondent[] }) {
  // Build histogram bins for CESD-R (0-60, bins of 10)
  const instruments = [
    { key: 'cesdr' as const, label: 'CESD-R (Depresi)', max: 60, binSize: 10, color: '#fb7185', thresholds: [{ v: 16, label: 'Bermakna' }] },
    { key: 'psqi' as const, label: 'PSQI (Tidur)', max: 21, binSize: 3, color: '#a5b4fc', thresholds: [{ v: 5, label: 'Buruk' }] },
    { key: 'mos' as const, label: 'MOS-SSS (Dukungan)', max: 40, binSize: 5, color: '#fcd34d', thresholds: [] },
    { key: 'bullying' as const, label: 'Bullying', max: 24, binSize: 4, color: '#fdba74', thresholds: [{ v: 8, label: 'Tinggi' }] },
    { key: 'religiosity' as const, label: 'Religiusitas', max: 40, binSize: 5, color: '#86efac', thresholds: [] },
  ]

  const completed = respondents.filter(r => r.scores.cesdr !== null)

  if (completed.length === 0) return null

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground">Distribusi Skor</h3>
        <Badge variant="secondary" className="ml-auto text-xs">{completed.length} responden</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {instruments.map((inst) => {
          const scores = completed.map(r => r.scores[inst.key]).filter(s => s !== null) as number[]
          if (scores.length === 0) return null
          const bins: { range: string; count: number; isThreshold?: boolean }[] = []
          for (let b = 0; b < inst.max; b += inst.binSize) {
            const end = Math.min(b + inst.binSize, inst.max)
            const count = scores.filter(s => s >= b && s < end).length
            const isThreshold = inst.thresholds.some(t => t.v >= b && t.v < end)
            bins.push({ range: `${b}-${end}`, count, isThreshold })
          }
          const maxCount = Math.max(...bins.map(b => b.count), 1)
          const mean = scores.reduce((a, b) => a + b, 0) / scores.length

          return (
            <div key={inst.key} className="rounded-2xl bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{inst.label}</h4>
                <span className="text-xs font-semibold text-foreground">
                  μ={Math.round(mean * 10) / 10}
                </span>
              </div>
              <div className="flex items-end gap-1" style={{ height: '80px' }}>
                {bins.map((bin, i) => (
                  <div key={i} className="group relative flex-1">
                    <div
                      className="w-full rounded-t-md transition-all hover:opacity-80"
                      style={{
                        height: `${(bin.count / maxCount) * 100}%`,
                        backgroundColor: inst.color,
                        minHeight: bin.count > 0 ? '4px' : '0',
                        opacity: bin.isThreshold ? 1 : 0.75,
                      }}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1 py-0.5 text-[9px] font-bold text-background opacity-0 transition-opacity group-hover:opacity-100">
                      {bin.count}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                <span>0</span>
                <span>{inst.max}</span>
              </div>
              {inst.thresholds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {inst.thresholds.map(t => (
                    <span key={t.label} className="text-[10px] text-muted-foreground">
                      ⚠ {t.label}: ≥{t.v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ScoreCell({ value, max, threshold, color }: { value: number | null; max: number; threshold?: number; color: string }) {
  if (value === null) return <span className="text-xs text-muted-foreground">-</span>
  const pct = Math.min(100, (value / max) * 100)
  const isThreshold = threshold !== undefined && value >= threshold
  const colorMap: Record<string, string> = {
    rose: 'bg-rose-400',
    indigo: 'bg-indigo-400',
    amber: 'bg-amber-400',
    orange: 'bg-orange-400',
    teal: 'bg-teal-400',
  }
  const textColorMap: Record<string, string> = {
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
    orange: 'text-orange-600',
    teal: 'text-teal-600',
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-xs font-bold ${isThreshold ? textColorMap[color] : 'text-foreground'}`}>
        {value}
      </span>
      <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${colorMap[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function CorrelationHeatmap({ matrix }: {
  matrix: Record<string, Record<string, number>>
}) {
  const vars = ['cesdr', 'psqi', 'mos', 'bullying', 'religiosity']
  const labels: Record<string, string> = {
    cesdr: 'CESD-R',
    psqi: 'PSQI',
    mos: 'MOS',
    bullying: 'Bully',
    religiosity: 'Relig',
  }

  function getColor(v: number) {
    // -1 to +1 → rose (negative) to emerald (positive), white at 0
    if (v >= 0) {
      const intensity = Math.min(1, v)
      return `rgba(125, 211, 192, ${intensity * 0.8})` // teal
    } else {
      const intensity = Math.min(1, Math.abs(v))
      return `rgba(251, 113, 133, ${intensity * 0.8})` // rose
    }
  }

  function getTextColor(v: number) {
    return Math.abs(v) > 0.5 ? 'white' : 'oklch(0.3 0.02 250)'
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="p-1"></th>
            {vars.map(v => (
              <th key={v} className="p-1 text-center text-[10px] font-semibold text-muted-foreground">
                {labels[v]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vars.map(rowVar => (
            <tr key={rowVar}>
              <td className="p-1 pr-2 text-right text-[10px] font-semibold text-muted-foreground">
                {labels[rowVar]}
              </td>
              {vars.map(colVar => {
                const val = matrix[rowVar]?.[colVar] ?? 0
                return (
                  <td key={colVar} className="p-0.5">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg text-xs font-bold transition-all hover:scale-110 hover:shadow-md"
                      style={{
                        backgroundColor: getColor(val),
                        color: getTextColor(val),
                      }}
                      title={`${labels[rowVar]} ↔ ${labels[colVar]}: r = ${val}`}
                    >
                      {val.toFixed(2)}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: 'rgba(251, 113, 133, 0.8)' }} /> Negatif (r {`<`} 0)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-white/50" /> Lemah (r ≈ 0)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: 'rgba(125, 211, 192, 0.8)' }} /> Positif (r {`>`} 0)
        </span>
      </div>
    </div>
  )
}
