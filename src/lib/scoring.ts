// TeenMind Research - Fungsi Skoring Instrumen
// Menghitung skor total untuk setiap instrumen sesuai panduan resmi.

import {
  CESDR_HIGH_RISK_ITEM,
  CESDR_HIGH_RISK_THRESHOLD,
  CLIMATE_REVERSE_ITEM_IDS,
  PSQI_ITEM_5A_ID,
  PSQI_C5_SUBITEM_IDS,
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
 * VERSI DIPERLUAS: kuesioner sekarang menyertakan 10 sub-item gangguan tidur
 * (5a-5j), item penggunaan obat tidur, dan 2 sub-item disfungsi siang hari —
 * mendekati struktur 19-item resmi. Fungsi ini otomatis mendeteksi skema data:
 *  - Jika sub-item 5a-5j & item obat tidur & item "daytimeEnthusiasm" ADA di
 *    jawaban → dipakai formula RESMI (lihat masing-masing komponen di bawah).
 *  - Jika TIDAK ada (data responden lama, sebelum kuesioner diperluas) →
 *    fallback ke formula ADAPTASI 7-item lama, supaya laporan untuk
 *    responden lama tetap bisa dihitung tanpa perlu isi ulang kuesioner.
 * `limitations` tetap diisi untuk komponen manapun yang masih memakai
 * fallback/pendekatan non-resmi pada suatu responden tertentu.
 */
export function scorePsqi(answers: PsqiAnswers): PsqiResult {
  const limitations: string[] = []

  // C1 — Kualitas tidur subjektif: item "sleepQuality" sudah berskala resmi 0-3.
  const c1 = clamp03(Number(answers.sleepQuality ?? 0))

  // C2 — Latensi tidur: skor resmi = (skor menit-untuk-tertidur) + (skor item 5a),
  // masing-masing 0-3, dijumlah (0-6) lalu dipetakan ke 0-3.
  const latencyMinutes = Number(answers.sleepLatency ?? 0)
  const latencyScore = latencyMinutes <= 15 ? 0 : latencyMinutes <= 30 ? 1 : latencyMinutes <= 60 ? 2 : 3
  const item5aRaw = answers[PSQI_ITEM_5A_ID]
  let c2: number
  if (item5aRaw !== undefined && item5aRaw !== null) {
    const item5aScore = clamp03(Number(item5aRaw))
    const c2Sum = latencyScore + item5aScore // 0-6
    c2 = c2Sum === 0 ? 0 : c2Sum <= 2 ? 1 : c2Sum <= 4 ? 2 : 3
  } else {
    c2 = latencyScore
    limitations.push(
      "C2 (latensi tidur): hanya memakai skor menit-untuk-tertidur karena item resmi 5a ('tidak bisa tidur dalam 30 menit') tidak tersedia pada data responden ini (kemungkinan diisi sebelum kuesioner diperluas)."
    )
  }

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

  // C5 — Gangguan tidur: resmi = jumlah 9 sub-item (5b-5j), masing-masing 0-3
  // (rentang 0-27), dipetakan ke 0-3.
  const c5SubValues = PSQI_C5_SUBITEM_IDS.map((id) => answers[id]).filter((v) => v !== undefined && v !== null)
  let c5: number
  if (c5SubValues.length === PSQI_C5_SUBITEM_IDS.length) {
    let c5Sum = 0
    for (const v of c5SubValues) c5Sum += clamp03(Number(v)) // 0-27
    c5 = c5Sum === 0 ? 0 : c5Sum <= 9 ? 1 : c5Sum <= 18 ? 2 : 3
  } else if (answers.sleepDisturbance !== undefined && answers.sleepDisturbance !== null) {
    c5 = clamp03(Number(answers.sleepDisturbance))
    limitations.push("C5 (gangguan tidur): memakai satu item gabungan lama ('sleepDisturbance'), bukan jumlah 9 sub-item resmi PSQI (5b-5j) — data responden ini diisi sebelum kuesioner diperluas.")
  } else {
    c5 = 0
    limitations.push("C5 (gangguan tidur): data sub-item tidak lengkap, komponen diberi skor 0.")
  }

  // C6 — Penggunaan obat tidur.
  const medRaw = answers.sleepMedication
  let c6: number
  if (medRaw !== undefined && medRaw !== null) {
    c6 = clamp03(Number(medRaw))
  } else {
    c6 = 0
    limitations.push("C6 (obat tidur): item ini tidak tersedia pada data responden ini (kemungkinan diisi sebelum kuesioner diperluas); skor diberi 0 — bukan hasil pengukuran, melainkan asumsi tidak ada penggunaan obat tidur.")
  }

  // C7 — Disfungsi siang hari: resmi = jumlah 2 sub-item (susah tetap terjaga +
  // kurang semangat), 0-6, dipetakan ke 0-3.
  const troubleAwakeRaw = answers.daySleepiness
  const enthusiasmRaw = answers.daytimeEnthusiasm
  let c7: number
  if (troubleAwakeRaw !== undefined && troubleAwakeRaw !== null && enthusiasmRaw !== undefined && enthusiasmRaw !== null) {
    const c7Sum = clamp03(Number(troubleAwakeRaw)) + clamp03(Number(enthusiasmRaw)) // 0-6
    c7 = c7Sum === 0 ? 0 : c7Sum <= 2 ? 1 : c7Sum <= 4 ? 2 : 3
  } else {
    c7 = clamp03(Number(troubleAwakeRaw ?? 0))
    limitations.push("C7 (disfungsi siang hari): memakai satu item ('mengantuk saat aktivitas'), karena sub-item kedua resmi ('kurang bersemangat') tidak tersedia pada data responden ini (kemungkinan diisi sebelum kuesioner diperluas).")
  }

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

/**
 * Skor victimisasi bullying (GBS / Gatehouse Bullying Scale) = jumlah item 1-4
 * saja (range 0-12). Item 5-12 (School Climate) BUKAN bagian dari skor
 * bullying — item tersebut adalah instrumen terpisah, lihat scoreClimateSchool().
 *
 * CATATAN PERBAIKAN: sebelumnya fungsi ini menjumlahkan seluruh item 1-12
 * (GBS + Climate tercampur), padahal field database menamainya `victimScore`.
 * Ini adalah bug pembalikan/pencampuran instrumen yang sudah diperbaiki di
 * sini — GBS dan Climate School sekarang dihitung oleh fungsi terpisah,
 * masing-masing dengan pedoman interpretasinya sendiri, meski jawabannya
 * tetap disimpan dalam satu objek `bullying` (item 1-4 = GBS, 5-12 = Climate).
 */
export function scoreBullying(answers: BullyingAnswers): number {
  let total = 0
  for (let i = 1; i <= 4; i++) total += answers[i] ?? 0
  return total
}

export type ClimateSchoolResult = {
  total: number
  maxScore: number
  minScore: number
  category: string
  interpretation: string
  recommendation: string | null
}

/**
 * Skor Climate School (Iklim Sekolah) = item 5-12 pada objek jawaban
 * `bullying` (8 item, skala 1-4 sesuai CLIMATE_OPTIONS: 1 = Sangat Setuju ...
 * 4 = Sangat Tidak Setuju). Item bernomor di CLIMATE_REVERSE_ITEM_IDS
 * (bermuatan negatif, mis. "saya merasa stres di sekolah") dibalik
 * (reverse-scored: 5 - nilai) sebelum dijumlah, supaya arah skor konsisten:
 * semakin tinggi skor total = semakin kurang supportif lingkungan sekolahnya.
 *
 * ADAPTASI INSTRUMEN: pedoman resmi yang dipakai sebagai acuan interpretasi
 * dirancang untuk 12 item (range 12-48, cutoff 24). Kuesioner pada aplikasi
 * ini memakai versi adaptasi 8-item (range 8-32). Cutoff diskalakan secara
 * proporsional dari pedoman resmi (24 berada di persentil ~33% dari rentang
 * 12-48), sehingga pada rentang 8-32 cutoff yang setara adalah 16. Batasan
 * ini perlu dicantumkan di bab metode tesis, mengikuti pola dokumentasi
 * keterbatasan yang sama seperti pada scorePsqi().
 */
export function scoreClimateSchool(answers: BullyingAnswers): ClimateSchoolResult {
  let total = 0
  for (let i = 5; i <= 12; i++) {
    const raw = answers[i] ?? 0
    total += CLIMATE_REVERSE_ITEM_IDS.includes(i) ? (raw === 0 ? 0 : 5 - raw) : raw
  }

  const maxScore = 32
  const minScore = 8
  const cutoff = 16 // lihat catatan adaptasi di atas

  if (total <= cutoff) {
    return {
      total,
      maxScore,
      minScore,
      category: "Lingkungan sekolah supportif",
      interpretation: "Responden menilai lingkungan sekolah masih memiliki dukungan sosial dan iklim sekolah yang baik.",
      recommendation: null,
    }
  }
  return {
    total,
    maxScore,
    minScore,
    category: "Lingkungan sekolah kurang supportif",
    interpretation: "Skor menunjukkan adanya indikasi lingkungan sekolah yang kurang mendukung dan berpotensi berkaitan dengan risiko bullying.",
    recommendation: "Disarankan dilakukan evaluasi lingkungan sekolah, penguatan peran guru BK, serta peningkatan program pencegahan bullying.",
  }
}

/**
 * Helper untuk route API: menghitung skor total Climate School langsung dari
 * field `bullying.answers` (JSON string) milik relasi Prisma, atau null bila
 * responden belum mengisi. Dipakai di berbagai route analisis (regresi,
 * mediasi, korelasi parsial, dst) supaya Climate School bisa dipakai sebagai
 * variabel terpisah dari GBS tanpa menduplikasi logika parsing di tiap route.
 */
export function climateScoreFromBullyingRelation(bullying: { answers: string } | null | undefined): number | null {
  if (!bullying) return null
  try {
    const parsed = JSON.parse(bullying.answers) as BullyingAnswers
    return scoreClimateSchool(parsed).total
  } catch {
    return null
  }
}

export type ReligiosityAnswers = Record<number, number>
/** Skor total religiusitas (8 item, range 8-32). Cut-off: Baik ≥20, Kurang <20. */
export function scoreReligiosity(answers: ReligiosityAnswers): number {
  let total = 0
  for (let i = 1; i <= 8; i++) total += answers[i] ?? 0
  return total
}

export type ScreenTimeAnswers = {
  weekdayScreen?: number // 0-4 (<1 jam ... >5 jam/hari)
  weekendScreen?: number // 0-4
  socialCompare?: number // 0-4 (Tidak pernah ... Selalu)
  cyberbullying?: number // 0-2 (Tidak pernah / 1-2 kali / >2 kali)
  sleepDelay?: number // 0-3 (Tidak pernah ... Sering ≥3x/minggu)
  platforms?: number[] // multi-select, bukan item skala — tidak diskor
}

export type ScreenTimeResult = {
  total: number
  maxScore: number
  minScore: number
  highScreenTime: boolean
  category: string
  interpretation: string
  recommendation: string | null
}

/**
 * Skor Screen Time & Media Sosial (5 item skala, item "platforms" dikecualikan
 * karena multi-select bukan item ordinal). Total = jumlah 5 item, range 0-17.
 *
 * PENTING — instrumen ini BUKAN skala psikometrik baku/tervalidasi (tidak
 * seperti CESD-R, PSQI, MOS-SSS, dsb). Tidak ada cut-off resmi dari
 * literatur untuk kombinasi 5 item ini. Kategori & threshold di bawah
 * adalah heuristik deskriptif yang disusun peneliti berdasarkan:
 *  - `highScreenTime` = true bila durasi screen time hari sekolah ATAU akhir
 *    pekan mencapai kategori ">3 jam/hari" (nilai item ≥3), sesuai catatan
 *    perancangan asli pada komentar SCREEN_TIME_QUESTIONS.
 *  - Kombinasi durasi tinggi + indikator distres media sosial (social
 *    comparison, cyberbullying, atau screen time mengganggu tidur) dipakai
 *    sebagai penanda risiko psikososial tambahan.
 * Cantumkan ini sebagai keterbatasan/deviasi instrumen di bab metode —
 * TIDAK disarankan dipakai sebagai skala skrining diagnostik seperti
 * instrumen lain, melainkan sebagai data deskriptif/kovariat.
 */
export function scoreScreenTime(answers: ScreenTimeAnswers): ScreenTimeResult {
  const weekday = answers.weekdayScreen ?? 0
  const weekend = answers.weekendScreen ?? 0
  const socialCompare = answers.socialCompare ?? 0
  const cyberbullying = answers.cyberbullying ?? 0
  const sleepDelay = answers.sleepDelay ?? 0

  const total = weekday + weekend + socialCompare + cyberbullying + sleepDelay
  const maxScore = 17
  const minScore = 0

  const highScreenTime = weekday >= 3 || weekend >= 3 // ">3 jam/hari"
  const distressSignal = cyberbullying >= 1 || sleepDelay >= 2 || socialCompare >= 3

  if (highScreenTime && distressSignal) {
    return {
      total,
      maxScore,
      minScore,
      highScreenTime,
      category: "Screen time tinggi disertai indikator distres media sosial",
      interpretation: "Durasi penggunaan gadget/media sosial tergolong tinggi (>3 jam/hari) dan disertai indikasi distres terkait media sosial (perbandingan sosial, cyberbullying, dan/atau gangguan tidur akibat gadget).",
      recommendation: "Anjurkan edukasi literasi digital, pembatasan screen time terjadwal, serta pemantauan lebih lanjut bila ditemukan indikasi cyberbullying.",
    }
  }
  if (highScreenTime) {
    return {
      total,
      maxScore,
      minScore,
      highScreenTime,
      category: "Screen time tinggi",
      interpretation: "Durasi penggunaan gadget/media sosial tergolong tinggi (>3 jam/hari), tanpa indikator distres media sosial yang menonjol.",
      recommendation: "Anjurkan pembatasan screen time terjadwal dan edukasi keseimbangan aktivitas.",
    }
  }
  if (distressSignal) {
    return {
      total,
      maxScore,
      minScore,
      highScreenTime,
      category: "Indikator distres media sosial",
      interpretation: "Durasi screen time dalam batas wajar, namun ditemukan indikasi distres terkait media sosial (perbandingan sosial, cyberbullying, dan/atau gangguan tidur akibat gadget).",
      recommendation: "Pantau lebih lanjut, terutama bila ada laporan cyberbullying berulang.",
    }
  }
  return {
    total,
    maxScore,
    minScore,
    highScreenTime,
    category: "Dalam batas wajar",
    interpretation: "Durasi screen time dan indikator penggunaan media sosial dalam batas wajar.",
    recommendation: null,
  }
}
