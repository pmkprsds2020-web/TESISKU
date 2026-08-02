'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Plus, Search, Copy, Check, Trash2, QrCode, Filter, Upload, FileText, X, Download } from 'lucide-react'

type CodeRow = {
  code: string
  school: string | null
  classGrade: string | null
  used: boolean
  createdAt: string
  respondent: { status: string; highRisk: boolean; completedAt: string | null } | null
}

export function CodesPanel() {
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'used' | 'unused'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Create form state
  const [prefix, setPrefix] = useState('SMP')
  const [school, setSchool] = useState('')
  const [count, setCount] = useState('10')
  const [startFrom, setStartFrom] = useState('1')
  const [creating, setCreating] = useState(false)

  // Import state
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (filter !== 'all') params.set('filter', filter)
    const res = await fetch(`/api/admin/codes?${params}`)
    const d = await res.json()
    if (d.codes) setCodes(d.codes)
    setLoading(false)
  }, [q, filter])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: prefix || 'SMP',
          school: school || undefined,
          count: Number(count) || 1,
          startFrom: Number(startFrom) || 1,
        }),
      })
      const d = await res.json()
      if (d.created) {
        setShowCreate(false)
        setSchool('')
        await load()
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`Hapus kode ${code}?`)) return
    const res = await fetch(`/api/admin/codes?code=${code}`, { method: 'DELETE' })
    if (res.ok) {
      await load()
    } else {
      const d = await res.json()
      alert(d.error || 'Gagal menghapus')
    }
  }

  async function handleImport() {
    if (!importText.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      // Parse CSV/plain text: one code per line, optional "code,school,classGrade"
      const lines = importText.trim().split('\n').map((l) => l.trim()).filter(Boolean)
      const payload = lines.map((line) => {
        const parts = line.split(',').map((p) => p.trim())
        return { code: parts[0], school: parts[1] || undefined, classGrade: parts[2] || undefined }
      })
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importCodes: payload }),
      })
      const d = await res.json()
      if (d.created !== undefined) {
        setImportResult({ created: d.created.length, skipped: payload.length - d.created.length })
        setImportText('')
        await load()
      }
    } finally {
      setImporting(false)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImportText(String(ev.target?.result ?? ''))
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const blob = new Blob('SMP004001,SMP Harapan,Kelas 7\nSMP004002,SMP Harapan,Kelas 7\nSMP004003,SMP Negeri 1,Kelas 8', { type: 'text/csv' })
    const url = URL.createObjectURL(blob as BlobPart)
    const a = document.createElement('a')
    a.href = url
    a.download = 'teenmind_codes_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-foreground">Kode Penelitian</h3>
          <p className="text-xs text-muted-foreground">
            {codes.length} kode · Bagikan ke responden
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setShowImport(!showImport); setShowCreate(false) }}
            className="rounded-xl"
          >
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowCreate(!showCreate); setShowImport(false) }}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm"
          >
            <Plus className="mr-1 h-4 w-4" /> Buat Kode
          </Button>
        </div>
      </div>

      {/* Import form */}
      {showImport && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 overflow-hidden rounded-2xl bg-muted/40 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">Import Kode dari CSV/Teks</h4>
            <button onClick={() => setShowImport(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Format: satu kode per baris, atau <code className="rounded bg-white px-1 dark:bg-white/10">kode,sekolah,kelas</code> (CSV).
            Kode yang sudah ada akan dilewati.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Pilih File
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadTemplate}
              className="rounded-lg"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Template
            </Button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportResult(null) }}
            placeholder={'SMP004001,SMP Harapan,Kelas 7\nSMP004002,SMP Harapan,Kelas 7\nSMP004003,SMP Negeri 1,Kelas 8'}
            rows={5}
            className="mt-3 w-full rounded-xl border bg-white p-3 font-mono text-xs shadow-sm focus-visible:ring-primary dark:bg-white/5"
          />
          {importResult && (
            <div className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300">
              ✅ {importResult.created} kode dibuat{importResult.skipped > 0 ? `, ${importResult.skipped} dilewati (sudah ada)` : ''}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleImport} disabled={importing || !importText.trim()} className="rounded-lg">
              {importing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              Import Kode
            </Button>
          </div>
        </motion.div>
      )}

      {/* Create form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 overflow-hidden rounded-2xl bg-muted/40 p-4"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Prefix</label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} className="h-9 font-mono" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Jumlah</label>
              <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="h-9" min="1" max="200" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Mulai Dari</label>
              <Input type="number" value={startFrom} onChange={(e) => setStartFrom(e.target.value)} className="h-9" min="1" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Sekolah (opsional)</label>
              <Input value={school} onChange={(e) => setSchool(e.target.value)} className="h-9" placeholder="SMP..." />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={creating} className="rounded-lg">
              {creating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Generate
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="rounded-lg">Batal</Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Contoh: prefix <span className="font-mono">SMP</span>, mulai dari 1, jumlah 10 →
            SMP001, SMP002, ... SMP010
          </p>
        </motion.div>
      )}

      {/* Search + filter */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode atau sekolah..."
            className="h-9 rounded-xl pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
          {(['all', 'unused', 'used'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                filter === f ? 'bg-white text-foreground shadow-sm dark:bg-white/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'unused' ? 'Belum' : 'Terpakai'}
            </button>
          ))}
        </div>
      </div>

      {/* Codes list */}
      <ScrollArea className="h-[55vh] rounded-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : codes.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            Tidak ada kode ditemukan.
          </div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {codes.map((c) => (
              <div
                key={c.code}
                className="group flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5 transition-all hover:shadow-sm dark:bg-white/5"
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${c.used ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30' : 'bg-muted text-muted-foreground'}`}>
                  {c.used ? <Check className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-foreground">{c.code}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.school || '—'}
                    {c.respondent && (
                      <span className={`ml-1 ${c.respondent.highRisk ? 'text-rose-500 font-medium' : ''}`}>
                        {c.respondent.highRisk ? '· ⚠ High Risk' : c.respondent.status === 'completed' ? '· Selesai' : '· Proses'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyCode(c.code)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Salin kode"
                  >
                    {copied === c.code ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  {!c.used && (
                    <button
                      onClick={() => handleDelete(c.code)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                      title="Hapus kode"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  )
}
