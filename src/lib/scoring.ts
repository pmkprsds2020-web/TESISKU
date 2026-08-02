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

/**
 * Skor PSQI global (0-21). Skor >5 menunjukkan kualitas tidur buruk.
 */
export function scorePsqi(answers: PsqiAnswers): number {
  // C2: Latensi tidur
  let c2 = 0
  const lat = Number(answers.sleepLatency ?? 0)
  if (lat > 60) c2 += 2
  else if (lat > 30) c2 += 1
  c2 += Number(answers.sleepDisturbance ?? 0)

  // C4: Efisiensi tidur
  const actual = Number(answers.actualSleep ?? 0)
  let c4 = 0
  if (actual >= 7) c4 = 0
  else if (actual >= 6) c4 = 1
  else if (actual >= 5) c4 = 2
  else c4 = 3

  // C5: Gangguan tidur
  const c5 = Number(answers.sleepDisturbance ?? 0)

  // C7: Disfungsi siang hari
  const c7 = Number(answers.daySleepiness ?? 0)

  // C1: Kualitas subjektif
  const c1 = Number(answers.sleepQuality ?? 0)

  // Total global (simplified)
  const total = Math.min(21, c1 + c2 + c4 + c5 + c7)
  return total
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
