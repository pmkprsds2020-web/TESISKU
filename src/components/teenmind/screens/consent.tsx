'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/store'
import { Avatar } from '@/components/teenmind/avatar'
import { ChevronDown, ShieldCheck, BookOpen, HandHeart, FileCheck, Lock } from 'lucide-react'

const CONSENT_SECTIONS = [
  {
    icon: BookOpen,
    color: 'text-sky-600 bg-sky-50',
    title: 'Tujuan Penelitian',
    body: 'Penelitian ini bertujuan memahami hubungan faktor biopsikososial (tidur, penggunaan media sosial, dukungan sosial, pengalaman perundungan, dan religiusitas) dengan gejala depresi pada remaja SMP. Hasilnya diharapkan membantu pengembangan program promotif kesehatan mental di sekolah.',
  },
  {
    icon: HandHeart,
    color: 'text-emerald-600 bg-emerald-50',
    title: 'Manfaat',
    body: 'Hasil penelitian dapat menjadi dasar perancangan program pencegahan depresi remaja dan dukungan kesehatan mental yang lebih baik di sekolah. Kamu juga berlatih mengenali perasaan dan kebiasaanmu sendiri.',
  },
  {
    icon: Lock,
    color: 'text-violet-600 bg-violet-50',
    title: 'Kerahasiaan',
    body: 'Identitasmu dirahasiakan. Jawabanmu hanya diberi kode penelitian, tidak ada nama lengkap. Data disimpan dengan aman dan hanya peneliti yang berwenang yang dapat mengaksesnya. Hasil dilaporkan secara agregat (kelompok), bukan per individu.',
  },
  {
    icon: ShieldCheck,
    color: 'text-amber-600 bg-amber-50',
    title: 'Hak Responden',
    body: 'Kamu berhak: (1) menolak ikut serta tanpa konsekuensi, (2) berhenti kapan saja, (3) tidak menjawab pertanyaan tertentu, (4) bertanya jika ada yang kurang jelas. Jika ada jawaban yang mengindikasikan kamu butuh dukungan, peneliti akan menghubungi guru BK/konselor sesuai prosedur etik.',
  },
  {
    icon: FileCheck,
    color: 'text-rose-600 bg-rose-50',
    title: 'Prosedur',
    body: 'Kuesioner terdiri dari 8 bagian (persetujuan, data diri, perasaan, tidur, gadget & medsos, dukungan sosial, pengalaman sekolah, dan ibadah). Diperkirakan membutuhkan ~28 menit. Jawaban tersimpan otomatis sehingga dapat dilanjutkan jika sambungan terputus.',
  },
]

export function ConsentScreen() {
  const session = useAppStore((s) => s.session)
  const [agreed, setAgreed] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const [readSections, setReadSections] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  const allRead = readSections.size === CONSENT_SECTIONS.length

  function toggleSection(idx: number) {
    setOpenIdx(openIdx === idx ? null : idx)
    setReadSections(prev => {
      const next = new Set(prev)
      next.add(idx)
      return next
    })
  }

  async function handleContinue() {
    if (!agreed || !session) return
    setSaving(true)
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'consent', answers: { agreed: true } }),
      })
      // advance stage locally
      useAppStore.setState((s) => ({
        session: s.session ? { ...s.session, currentStage: 'demographics', consentGiven: true, stageIndex: 0 } : s.session,
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Avatar mood="calm" message="Sebelum mulai, baca dulu ya. Penting banget 📋" size="sm" />
      </div>

      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-300 to-sky-300 text-3xl shadow-lg ring-4 ring-white/50">
          📋
        </div>
        <h1 className="text-2xl font-bold text-foreground">Lembar Persetujuan (Assen)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Halo! Sebelum mengisi, kami jelaskan dulu tentang penelitian ini.
        </p>
      </div>

      {/* Read progress indicator */}
      <div className="mb-4 rounded-2xl bg-white/70 p-3 ring-1 ring-black/5 backdrop-blur dark:bg-white/5 dark:ring-white/10">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            {allRead ? '✓ Semua bagian dibaca' : `${readSections.size}/${CONSENT_SECTIONS.length} bagian dibaca`}
          </span>
          <span className="font-semibold text-primary">{Math.round((readSections.size / CONSENT_SECTIONS.length) * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400"
            initial={{ width: 0 }}
            animate={{ width: `${(readSections.size / CONSENT_SECTIONS.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        {/* Section dots */}
        <div className="mt-2 flex justify-center gap-1.5">
          {CONSENT_SECTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => toggleSection(i)}
              className={`h-2 w-2 rounded-full transition-all ${
                readSections.has(i)
                  ? 'bg-emerald-400'
                  : openIdx === i
                  ? 'bg-primary scale-125'
                  : 'bg-muted-foreground/30'
              }`}
              title={CONSENT_SECTIONS[i].title}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {CONSENT_SECTIONS.map((s, i) => {
          const open = openIdx === i
          const isRead = readSections.has(i)
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-all ${
                isRead ? 'ring-emerald-200 dark:ring-emerald-900' : 'ring-black/5'
              }`}
            >
              <button
                onClick={() => toggleSection(i)}
                className="flex w-full items-center gap-3 p-4 text-left"
                aria-expanded={open}
              >
                <div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                  {isRead && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white"
                    >
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  )}
                </div>
                <span className="flex-1 font-semibold text-foreground">{s.title}</span>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="px-4 pb-4 pt-0">
                      <div className="rounded-xl bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground/80">
                        {s.body}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      <motion.label
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
      >
        <Checkbox
          checked={agreed}
          onCheckedChange={(v) => setAgreed(v === true)}
          className="mt-0.5 h-5 w-5"
          id="agree"
        />
        <span className="text-sm font-medium text-foreground">
          Saya telah membaca dan bersedia mengikuti penelitian ini. Saya tahu
          saya boleh berhenti kapan saja tanpa konsekuensi.
        </span>
      </motion.label>

      <div className="mt-6">
        <Button
          size="lg"
          disabled={!agreed || saving}
          onClick={handleContinue}
          className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-sky-500 text-lg font-bold text-white shadow-xl shadow-violet-500/30 hover:from-violet-600 hover:to-sky-600 disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Saya Bersedia, Lanjut →'}
        </Button>
        {!agreed && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Centang persetujuan untuk melanjutkan
          </p>
        )}
      </div>
    </div>
  )
}
