// TeenMind Research - Fungsi Skoring Instrumen
// Menghitung skor total untuk setiap instrumen sesuai panduan resmi.

import {
  CESDR_HIGH_RISK_ITEM,
  CESDR_HIGH_RISK_THRESHOLD,
} from "./instruments"

export type CesdrAnswers = Record<number, number>

/** Skor total CESD-R = jumlah seluruh 20 item (0-60). Skor >=16 menandakan gejala depresi bermakna. */
export function scoreCesdr(answers: CesdrAnswers): {
  total: number
  highRisk: boolean
  depressive: boolean
  severity: string
} {
  let total = 0
  for (let i = 1; i <= 20; i++) total += answers[i] ?? 0
  const highRisk = (answers[CESDR_HIGH_RISK_ITEM] ?? 0) >= CESDR_HIGH_RISK_THRESHOLD
  const depressive = total >= 16
  let severity = "Minimal"
  if (total >= 16 && total < 21) severity = "Ringan"
  else if (total >= 21 && total < 28) severity = "Sedang"
  else if (total >= 28) severity = "Berat"
  return { total, highRisk, depressive, severity }
}

export type PsqiAnswers = Record<string, number | string>

export type PsqiComponents = {
  c1_subjectiveQuality: number
  c2_sleepLatency: number
  c3_sleepDuration: number
  c4_sleepEfficiency: number
  c5_sleepDisturbance: number
  c6_sleepMedication: number
  c7_daytimeDysfunction: number
}

export type PsqiResult = {
  total: number
  components: PsqiComponents
  poorSleepQuality: boolean
  /** Known deviations from the official 19-item PSQI, due to this app's 7-question adapted version. */
  limitations: string[]
}

function clamp03(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(3, Math.round(v)))
}

/** Parses "HH:MM" (24h, as produced by <input type="time">) into minutes since midnight. */
function parseTimeToMinutes(t: unknown): number | null {
  if (typeof t !== "string" || !/^\d{1,2}:\d{2}$/.test(t)) return null
  const [h, m] = t.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/**
 * Skor PSQI global (0-21), mengikuti struktur 7-komponen resmi
 * (Buysse DJ, Reynolds CF, Monk TH, Berman SR, Kupfer DJ. Psychiatry Res. 1989).
 * Skor global >5 = kualitas tidur buruk.
 *
 * CATATAN PENTING: kuesioner di aplikasi ini adalah versi ADAPTASI 7-pertanyaan
 * untuk remaja, bukan PSQI resmi 19-item. Item 5a-5j (9 sub-penyebab gangguan
 * tidur) dan item obat tidur (C6) tidak ditanyakan terpisah. Setiap komponen
 * yang terpengaruh keterbatasan ini didokumentasikan di `limitations` pada
 * hasil — cantumkan ini sebagai keterbatasan instrumen di bab metode tesis.
 */
export function scorePsqi(answers: PsqiAnswers): PsqiResult {
  const limitations: string[] = []

  // C1 — Kualitas tidur subjektif: item "sleepQuality" sudah berskala resmi 0-3.
  const c1 = clamp03(Number(answers.sleepQuality ?? 0))

  // C2 — Latensi tidur: skor resmi = (skor menit-untuk-tertidur) + (skor item 5a),
  // masing-masing 0-3, dijumlah lalu dipetakan ke 0-3. Kuesioner ini tidak
  // punya item 5a terpisah, jadi C2 hanya memakai skor menit-untuk-tertidur.
  const latencyMinutes = Number(answers.sleepLatency ?? 0)
  const c2 = latencyMinutes <= 15 ? 0 : latencyMinutes <= 30 ? 1 : latencyMinutes <= 60 ? 2 : 3
  limitations.push(
    "C2 (latensi tidur): hanya memakai skor menit-untuk-tertidur karena item resmi 5a ('tidak bisa tidur dalam 30 menit') tidak ditanyakan terpisah."
  )

  // C3 — Durasi tidur: cutoff resmi berdasarkan jam tidur aktual.
  const hours = Number(answers.actualSleep ?? 0)
  const c3 = hours > 7 ? 0 : hours >= 6 ? 1 : hours >= 5 ? 2 : 3

  // C4 — Efisiensi tidur kebiasaan = (jam tidur aktual / jam di tempat tidur) x 100%,
  // jam di tempat tidur dihitung dari selisih waketime - bedtime (menangani lintas tengah malam).
  const bedMin = parseTimeToMinutes(answers.bedtime)
  const wakeMin = parseTimeToMinutes(answers.waketime)
  let c4 = 0
  if (bedMin !== null && wakeMin !== null && hours > 0) {
    let timeInBedMin = wakeMin - bedMin
    if (timeInBedMin <= 0) timeInBedMin += 24 * 60 // tidur melewati tengah malam
    const timeInBedHours = timeInBedMin / 60
    const efficiency = timeInBedHours > 0 ? (hours / timeInBedHours) * 100 : 0
    c4 = efficiency >= 85 ? 0 : efficiency >= 75 ? 1 : efficiency >= 65 ? 2 : 3
  } else {
    limitations.push("C4 (efisiensi tidur): jam tidur/bangun tidak lengkap, komponen diberi skor 0.")
  }

  // C5 — Gangguan tidur: resmi = rata-rata 9 sub-item (5b-5j), masing-masing 0-3,
  // dijumlah 0-27 lalu dipetakan ke 0-3. Kuesioner ini hanya punya SATU item
  // gabungan (0-3), dipakai langsung sebagai proksi C5.
  const c5 = clamp03(Number(answers.sleepDisturbance ?? 0))
  limitations.push("C5 (gangguan tidur): memakai satu item gabungan, bukan rata-rata 9 sub-item resmi PSQI (5b-5j).")

  // C6 — Penggunaan obat tidur: TIDAK ditanyakan sama sekali di kuesioner ini.
  // Diberi skor 0 untuk semua responden — ini bukan hasil pengukuran, melainkan
  // asumsi tidak ada penggunaan obat tidur, dan harus dicantumkan sebagai keterbatasan.
  const c6 = 0
  limitations.push("C6 (obat tidur): item ini tidak ada di kuesioner; skor selalu 0 untuk semua responden (bukan hasil pengukuran).")

  // C7 — Disfungsi siang hari: resmi = rata-rata 2 sub-item (susah tetap terjaga +
  // kurang semangat), 0-6, dipetakan ke 0-3. Hanya ada 1 item ("daySleepiness") di sini.
  const c7 = clamp03(Number(answers.daySleepiness ?? 0))
  limitations.push("C7 (disfungsi siang hari): memakai satu item ('mengantuk saat aktivitas'), bukan rata-rata 2 sub-item resmi PSQI.")

  const total = c1 + c2 + c3 + c4 + c5 + c6 + c7

  return {
    total,
    components: {
      c1_subjectiveQuality: c1,
      c2_sleepLatency: c2,
      c3_sleepDuration: c3,
      c4_sleepEfficiency: c4,
      c5_sleepDisturbance: c5,
      c6_sleepMedication: c6,
      c7_daytimeDysfunction: c7,
    },
    poorSleepQuality: total > 5,
    limitations,
  }
}

export type MosAnswers = Record<number, number>
/** Skor total MOS-SSS (10 item, range 10-50). */
export function scoreMos(answers: MosAnswers): number {
  let total = 0
  for (let i = 1; i <= 10; i++) {
    if (answers[i] != null) {
      total += answers[i]
    }
  }
  return total
}

export type BullyingAnswers = Record<number, number>
/** Skor victimisasi bullying = jumlah GBS items (1-4) + School Climate items (5-12). */
export function scoreBullying(answers: BullyingAnswers): number {
  let total = 0
  for (let i = 1; i <= 12; i++) total += answers[i] ?? 0
  return total
}

export type ReligiosityAnswers = Record<number, number>
/** Skor total religiusitas (8 item, range 8-32). Cut-off: Baik ≥20, Kurang <20. */
export function scoreReligiosity(answers: ReligiosityAnswers): number {
  let total = 0
  for (let i = 1; i <= 8; i++) total += answers[i] ?? 0
  return total
}
