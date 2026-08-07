// TeenMind Research - Interpretasi & Kesimpulan Otomatis
//
// Single source of truth untuk interpretasi setiap instrumen, kesimpulan
// skrining, narasi interpretasi klinis, dan rekomendasi tindak lanjut.
// Dipakai oleh API laporan responden (admin) dan halaman cetak/PDF, supaya
// dashboard, laporan, dan PDF selalu menampilkan teks yang identik.

import { scoreClimateSchool, type BullyingAnswers } from "./scoring"

export type InstrumentAnalysis = {
  key: "cesdr" | "psqi" | "mos" | "gbs" | "climate" | "religiosity"
  label: string
  score: number | null
  maxScore: number
  category: string
  interpretation: string
  recommendation: string | null
  warn: boolean
}

export type ScreeningInput = {
  cesdr: number | null
  cesdrHighRisk: boolean
  psqi: number | null
  mos: number | null
  gbs: number | null
  bullyingAnswers: BullyingAnswers | null
  religiosity: number | null
}

export function interpretCesdr(total: number | null): { category: string; interpretation: string; recommendation: string | null; warn: boolean } {
  if (total === null) return { category: "Belum diisi", interpretation: "Data belum tersedia.", recommendation: null, warn: false }
  if (total >= 16) {
    return {
      category: "Gejala depresi bermakna",
      interpretation: "Menunjukkan adanya gejala depresi yang bermakna.",
      recommendation: "Perlu dilakukan skrining lanjutan atau evaluasi psikologis/psikiatri sesuai kondisi klinis.",
      warn: true,
    }
  }
  return {
    category: "Tidak ada indikasi bermakna",
    interpretation: "Tidak ditemukan indikasi gejala depresi bermakna.",
    recommendation: null,
    warn: false,
  }
}

export function interpretPsqi(total: number | null): { category: string; interpretation: string; recommendation: string | null; warn: boolean } {
  if (total === null) return { category: "Belum diisi", interpretation: "Data belum tersedia.", recommendation: null, warn: false }
  if (total > 5) {
    return {
      category: "Kualitas tidur buruk",
      interpretation: "Kualitas tidur buruk.",
      recommendation: "Perlu edukasi sleep hygiene dan evaluasi lebih lanjut bila keluhan menetap.",
      warn: true,
    }
  }
  return { category: "Kualitas tidur baik", interpretation: "Kualitas tidur baik.", recommendation: null, warn: false }
}

export function interpretMos(total: number | null): { category: string; interpretation: string; recommendation: string | null; warn: boolean } {
  if (total === null) return { category: "Belum diisi", interpretation: "Data belum tersedia.", recommendation: null, warn: false }
  if (total > 25) {
    return {
      category: "Dukungan sosial tinggi",
      interpretation: "Responden memiliki dukungan sosial yang baik dari keluarga, teman, maupun lingkungan.",
      recommendation: null,
      warn: false,
    }
  }
  return {
    category: "Dukungan sosial rendah",
    interpretation: "Responden memiliki dukungan sosial yang rendah sehingga berpotensi membutuhkan penguatan dukungan keluarga maupun lingkungan sekitar.",
    recommendation: "Anjurkan peningkatan komunikasi keluarga, dukungan teman sebaya, serta pendampingan sekolah bila diperlukan.",
    warn: true,
  }
}

/**
 * Interpretasi GBS (Gatehouse Bullying Scale, item 1-4, range 0-12).
 * Pedoman resmi Gatehouse Bullying Scale tidak memakai satu cutoff tunggal
 * baku untuk versi 4-item ini, sehingga tingkatan berikut memakai gradasi
 * frekuensi jawaban (bukan skor absolut semata) sebagai pendekatan yang
 * lebih sesuai dengan cara instrumen ini dirancang (per-item, bukan skala
 * unidimensi). Cantumkan pendekatan ini sebagai keterbatasan di bab metode.
 */
export function interpretGBS(total: number | null): { category: string; interpretation: string; recommendation: string | null; warn: boolean } {
  if (total === null) return { category: "Belum diisi", interpretation: "Data belum tersedia.", recommendation: null, warn: false }
  if (total === 0) {
    return {
      category: "Tidak ada indikasi perundungan",
      interpretation: "Responden tidak melaporkan pengalaman diintimidasi, diejek, dikucilkan, atau menjadi sasaran gosip negatif dalam 3 bulan terakhir.",
      recommendation: null,
      warn: false,
    }
  }
  if (total <= 4) {
    return {
      category: "Indikasi ringan",
      interpretation: "Responden melaporkan pengalaman perundungan pada tingkat ringan (frekuensi rendah).",
      recommendation: "Pantau perkembangan responden dan pastikan akses ke guru BK bila keluhan berlanjut.",
      warn: false,
    }
  }
  return {
    category: "Indikasi sedang-berat",
    interpretation: "Responden melaporkan pengalaman perundungan pada tingkat sedang hingga berat, dengan frekuensi yang cukup sering.",
    recommendation: "Perlu tindak lanjut segera oleh guru BK/konselor sekolah dan pencegahan bullying yang lebih intensif.",
    warn: true,
  }
}

export function interpretReligiosity(total: number | null): { category: string; interpretation: string; recommendation: string | null; warn: boolean } {
  if (total === null) return { category: "Belum diisi", interpretation: "Data belum tersedia.", recommendation: null, warn: false }
  // Semakin tinggi skor menunjukkan tingkat religiusitas yang lebih baik.
  if (total >= 20) {
    return {
      category: "Religiusitas baik",
      interpretation: "Skor menunjukkan tingkat religiusitas yang baik; semakin tinggi skor mencerminkan praktik ibadah yang semakin konsisten.",
      recommendation: null,
      warn: false,
    }
  }
  return {
    category: "Religiusitas kurang",
    interpretation: "Skor menunjukkan tingkat religiusitas yang masih kurang; semakin rendah skor mencerminkan praktik ibadah yang belum konsisten.",
    recommendation: "Dapat dipertimbangkan pendampingan spiritual/keagamaan sebagai bagian dari dukungan psikososial.",
    warn: true,
  }
}

/** Membangun panel "Analisis Hasil Skrining" untuk keenam instrumen. */
export function buildScreeningAnalysis(input: ScreeningInput): InstrumentAnalysis[] {
  const cesdr = interpretCesdr(input.cesdr)
  const psqi = interpretPsqi(input.psqi)
  const mos = interpretMos(input.mos)
  const gbs = interpretGBS(input.gbs)
  const climate = input.bullyingAnswers ? scoreClimateSchool(input.bullyingAnswers) : null
  const religiosity = interpretReligiosity(input.religiosity)

  return [
    { key: "cesdr", label: "CESD-R (Depresi)", score: input.cesdr, maxScore: 60, ...cesdr },
    { key: "psqi", label: "PSQI (Kualitas Tidur)", score: input.psqi, maxScore: 21, ...psqi },
    { key: "mos", label: "MOS-SSS (Dukungan Sosial)", score: input.mos, maxScore: 50, ...mos },
    { key: "gbs", label: "Bullying (GBS)", score: input.gbs, maxScore: 12, ...gbs },
    {
      key: "climate",
      label: "Climate School (Iklim Sekolah)",
      score: climate?.total ?? null,
      maxScore: 32,
      category: climate?.category ?? "Belum diisi",
      interpretation: climate?.interpretation ?? "Data belum tersedia.",
      recommendation: climate?.recommendation ?? null,
      warn: climate ? climate.category !== "Lingkungan sekolah supportif" : false,
    },
    { key: "religiosity", label: "Religiusitas", score: input.religiosity, maxScore: 32, ...religiosity },
  ]
}

/** Kesimpulan Skrining — satu kalimat dinamis per instrumen yang sudah terisi. */
export function buildConclusion(analysis: InstrumentAnalysis[]): string[] {
  const lines: string[] = []
  for (const a of analysis) {
    if (a.score === null) continue
    switch (a.key) {
      case "cesdr":
        lines.push(
          a.warn
            ? `Hasil skrining menunjukkan responden memiliki gejala depresi bermakna berdasarkan skor CESD-R (${a.score}).`
            : `Tidak ditemukan indikasi gejala depresi bermakna berdasarkan skor CESD-R (${a.score}).`
        )
        break
      case "psqi":
        lines.push(
          a.warn
            ? `Kualitas tidur responden tergolong buruk berdasarkan skor PSQI (${a.score}).`
            : `Kualitas tidur responden tergolong baik berdasarkan skor PSQI (${a.score}).`
        )
        break
      case "mos":
        lines.push(
          a.warn
            ? `Dukungan sosial tergolong rendah berdasarkan skor MOS-SSS (${a.score}).`
            : `Dukungan sosial tergolong tinggi berdasarkan skor MOS-SSS (${a.score}).`
        )
        break
      case "gbs":
        lines.push(
          a.warn
            ? `Skor GBS (${a.score}) menunjukkan indikasi pengalaman perundungan pada tingkat sedang-berat.`
            : a.score === 0
              ? `Tidak ditemukan indikasi pengalaman perundungan berdasarkan skor GBS.`
              : `Skor GBS (${a.score}) menunjukkan indikasi pengalaman perundungan pada tingkat ringan.`
        )
        break
      case "climate":
        lines.push(
          a.warn
            ? `Skor Climate School (${a.score}) menunjukkan lingkungan sekolah kurang supportif.`
            : `Skor Climate School (${a.score}) menunjukkan lingkungan sekolah masih supportif.`
        )
        break
      case "religiosity":
        lines.push(
          a.warn
            ? `Tingkat religiusitas tergolong kurang berdasarkan skor religiusitas (${a.score}).`
            : `Tingkat religiusitas tergolong baik berdasarkan skor religiusitas (${a.score}).`
        )
        break
    }
  }

  const anyRisk = analysis.some((a) => a.warn)
  if (anyRisk) {
    lines.push(
      "Temuan tersebut mengindikasikan perlunya perhatian terhadap kondisi psikologis responden serta penguatan dukungan dari keluarga dan sekolah."
    )
  }
  return lines
}

/** Interpretasi Klinis — narasi naratif menggabungkan seluruh instrumen. */
export function buildClinicalNarrative(analysis: InstrumentAnalysis[]): string {
  const byKey = Object.fromEntries(analysis.map((a) => [a.key, a])) as Record<InstrumentAnalysis["key"], InstrumentAnalysis>
  if (analysis.every((a) => a.score === null)) {
    return "Data skrining belum lengkap sehingga interpretasi klinis belum dapat disusun."
  }

  const parts: string[] = []

  const cesdr = byKey.cesdr
  const psqi = byKey.psqi
  if (cesdr?.score !== null && cesdr?.warn) {
    parts.push("responden menunjukkan adanya gejala depresi yang bermakna")
    if (psqi?.score !== null) {
      parts.push(psqi.warn ? "disertai kualitas tidur yang kurang baik" : "meski kualitas tidur tergolong baik")
    }
  } else if (cesdr?.score !== null) {
    parts.push("responden tidak menunjukkan indikasi gejala depresi yang bermakna")
    if (psqi?.score !== null && psqi.warn) {
      parts.push("meski kualitas tidur tergolong kurang baik dan perlu tetap dipantau")
    }
  }

  let opening = ""
  if (parts.length > 0) {
    opening = `Berdasarkan hasil skrining, ${parts.join(", ")}. `
  } else {
    opening = "Berdasarkan hasil skrining, "
  }

  const factors: string[] = []
  const mos = byKey.mos
  if (mos?.score !== null) {
    factors.push(
      mos.warn
        ? "Dukungan sosial tergolong rendah sehingga dapat menjadi faktor risiko psikososial"
        : "Dukungan sosial tergolong tinggi sehingga dapat menjadi faktor protektif"
    )
  }
  const climate = byKey.climate
  if (climate?.score !== null) {
    factors.push(
      climate.warn
        ? "lingkungan sekolah dinilai kurang supportif sehingga dapat menjadi faktor risiko psikososial tambahan"
        : "lingkungan sekolah dinilai cukup supportif sehingga dapat menjadi faktor protektif"
    )
  }
  const gbs = byKey.gbs
  if (gbs?.score !== null && gbs.score > 0) {
    factors.push(gbs.warn ? "terdapat indikasi pengalaman perundungan pada tingkat yang perlu perhatian" : "terdapat indikasi pengalaman perundungan pada tingkat ringan")
  }
  const religiosity = byKey.religiosity
  if (religiosity?.score !== null) {
    factors.push(religiosity.warn ? "tingkat religiusitas tergolong kurang" : "tingkat religiusitas tergolong baik sehingga berpotensi menjadi faktor protektif tambahan")
  }

  let middle = ""
  if (factors.length > 0) {
    const [first, ...rest] = factors
    const capFirst = first.charAt(0).toUpperCase() + first.slice(1)
    middle = rest.length > 0 ? `${capFirst}, ${rest.join(", ")}. ` : `${capFirst}. `
  }

  const anyRisk = analysis.some((a) => a.warn)
  const closing = anyRisk
    ? "Secara keseluruhan disarankan dilakukan asesmen lanjutan oleh guru BK atau tenaga kesehatan mental serta penguatan dukungan keluarga dan sekolah."
    : "Secara keseluruhan responden menunjukkan profil psikososial yang cukup baik, namun pemantauan berkala tetap disarankan sebagai bagian dari kesehatan mental preventif."

  return `${opening}${middle}${closing}`
}

/** Rekomendasi Tindak Lanjut — daftar rekomendasi dinamis, tanpa duplikasi. */
export function buildRecommendations(analysis: InstrumentAnalysis[]): string[] {
  const recs = new Set<string>()
  for (const a of analysis) {
    if (a.recommendation) recs.add(a.recommendation)
  }
  // Rekomendasi umum tambahan bila ada temuan berisiko.
  if (analysis.some((a) => a.warn)) {
    recs.add("Rujukan ke psikolog/psikiater bila diperlukan sesuai penilaian klinis.")
  }
  return Array.from(recs)
}
