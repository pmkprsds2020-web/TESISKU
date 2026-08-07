import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { CLIMATE_REVERSE_ITEM_IDS, PSQI_C5_SUBITEM_IDS, PSQI_ITEM_5A_ID } from "@/lib/instruments"

// POST /api/admin/reliability
// Body: { instrument: "cesdr"|"psqi"|"mos"|"gbs"|"climate"|"religiosity"|"screentime" }
// Returns: Cronbach's alpha, item-total correlations, alpha-if-deleted
//
// NOTE (perbaikan): sebelumnya instrumen ini hanya menerima
// "cesdr"|"mos"|"bullying"|"religiosity" dengan numItems HARDCODE yang salah
// untuk MOS (ditulis 8, padahal MOS-SSS punya 10 item) dan "bullying" (ditulis
// 8, padahal field itu berisi 12 item campuran GBS+Climate School — hasilnya
// mengambil item 1-8 yaitu GBS 1-4 tercampur Climate 5-8, membuang item 9-12
// sepenuhnya). Sekarang GBS dan Climate School dipisah jadi dua instrumen
// analisis tersendiri, sesuai perbaikan skoring di src/lib/scoring.ts.
//
// NOTE (PSQI diperluas): field PSQI dulu mencampur item mentah "sleepLatency"
// (menit, 0-180) dan "actualSleep" (jam, 0-12) langsung dengan item skala 0-3
// dalam satu pool item untuk Cronbach's alpha — secara metodologis kurang
// tepat karena skalanya tidak sebanding. Sekarang dipakai HANYA item berskala
// 0-3 resmi: 10 sub-item gangguan tidur (5a-5j), kualitas tidur, obat tidur,
// dan 2 sub-item disfungsi siang hari (14 item total).
type Instrument = "cesdr" | "psqi" | "mos" | "gbs" | "climate" | "religiosity" | "screentime"

const PSQI_SCALE_FIELDS = [PSQI_ITEM_5A_ID, ...PSQI_C5_SUBITEM_IDS, "sleepQuality", "sleepMedication", "daySleepiness", "daytimeEnthusiasm"]

const INSTRUMENT_CONFIG: Record<Instrument, { table: "cesdr" | "psqi" | "mos" | "bullying" | "religiosity" | "screentime"; numItems: number; itemOffset: number; reverseItems?: number[] }> = {
  cesdr: { table: "cesdr", numItems: 20, itemOffset: 1 },
  psqi: { table: "psqi", numItems: PSQI_SCALE_FIELDS.length, itemOffset: 0 }, // named fields, not numeric item ids — handled separately below
  mos: { table: "mos", numItems: 10, itemOffset: 1 },
  gbs: { table: "bullying", numItems: 4, itemOffset: 1 },
  climate: { table: "bullying", numItems: 8, itemOffset: 5, reverseItems: CLIMATE_REVERSE_ITEM_IDS },
  religiosity: { table: "religiosity", numItems: 8, itemOffset: 1 },
  screentime: { table: "screentime", numItems: 5, itemOffset: 0 }, // named fields (weekdayScreen, ... sleepDelay), "platforms" excluded (multi-select)
}

const SCREENTIME_ORDINAL_FIELDS = ["weekdayScreen", "weekendScreen", "socialCompare", "cyberbullying", "sleepDelay"]

const INSTRUMENT_NAMES: Record<Instrument, string> = {
  cesdr: "CESD-R (Depresi)",
  psqi: "PSQI (Kualitas Tidur, 14 item skala 0-3)",
  mos: "MOS-SSS (Dukungan Sosial)",
  gbs: "Gatehouse Bullying Scale (GBS)",
  climate: "Climate School (Iklim Sekolah)",
  religiosity: "Skala Religiusitas",
  screentime: "Screen Time & Media Sosial (deskriptif, bukan skala baku)",
}

export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { instrument } = (await req.json()) as { instrument: Instrument }
  if (!(instrument in INSTRUMENT_CONFIG)) {
    return NextResponse.json({ error: "Invalid instrument" }, { status: 400 })
  }
  const config = INSTRUMENT_CONFIG[instrument]

  const respondents = await db.respondent.findMany({
    where: { projectId: admin, status: "completed" },
    include: {
      cesdr: true,
      psqi: true,
      mos: true,
      bullying: true,
      religiosity: true,
      screentime: true,
    },
  })

  const numItems = config.numItems
  const matrix: number[][] = []

  for (const r of respondents) {
    const ans = r[config.table]
    if (!ans) continue
    const parsed = JSON.parse(ans.answers) as Record<string, number | string>
    const items: number[] = []

    if (instrument === "psqi") {
      // Hanya item berskala 0-3 resmi (lihat PSQI_SCALE_FIELDS). Responden
      // lama (sebelum kuesioner diperluas) tidak akan punya field 5a-5j/
      // sleepMedication/daytimeEnthusiasm lengkap dan otomatis ter-skip di
      // bawah (items.length !== numItems), sehingga hanya responden dengan
      // data lengkap versi baru yang dianalisis di sini.
      for (const key of PSQI_SCALE_FIELDS) {
        const v = parsed[key]
        if (v !== undefined && v !== null && typeof v === "number") items.push(v)
      }
    } else if (instrument === "screentime") {
      for (const key of SCREENTIME_ORDINAL_FIELDS) {
        const v = parsed[key]
        if (v !== undefined && v !== null && typeof v === "number") items.push(v)
      }
    } else {
      for (let i = config.itemOffset; i < config.itemOffset + numItems; i++) {
        const raw = parsed[i]
        if (raw === undefined || raw === null) continue
        const num = Number(raw)
        items.push(config.reverseItems?.includes(i) ? (num === 0 ? 0 : 5 - num) : num)
      }
    }
    if (items.length === numItems) matrix.push(items)
  }

  if (matrix.length < 3) {
    return NextResponse.json({
      error: `Data tidak cukup (${matrix.length} responden, minimal 3 diperlukan)`,
    })
  }

  const n = matrix.length
  const k = matrix[0].length

  // Compute Cronbach's alpha: α = (k / (k-1)) * (1 - Σσᵢ² / σₜ²)
  // where σᵢ² = variance of item i, σₜ² = variance of total scores
  const itemMeans: number[] = []
  const itemVars: number[] = []
  for (let j = 0; j < k; j++) {
    const col = matrix.map(row => row[j])
    const mean = col.reduce((a, b) => a + b, 0) / n
    const variance = n > 1 ? col.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1) : 0
    itemMeans.push(mean)
    itemVars.push(variance)
  }

  // Total scores
  const totals = matrix.map(row => row.reduce((a, b) => a + b, 0))
  const totalMean = totals.reduce((a, b) => a + b, 0) / n
  const totalVar = n > 1 ? totals.reduce((sum, t) => sum + (t - totalMean) ** 2, 0) / (n - 1) : 0

  const sumItemVars = itemVars.reduce((a, b) => a + b, 0)
  const cronbachAlpha = totalVar > 0 ? (k / (k - 1)) * (1 - sumItemVars / totalVar) : 0

  // Item-total correlations and alpha-if-deleted
  const itemLabels: (number | string)[] =
    instrument === "psqi" ? PSQI_SCALE_FIELDS :
    instrument === "screentime" ? SCREENTIME_ORDINAL_FIELDS :
    Array.from({ length: k }, (_, j) => config.itemOffset + j)

  const itemStats: { item: number | string; mean: number; sd: number; itemTotalCorr: number; alphaIfDeleted: number }[] = []
  for (let j = 0; j < k; j++) {
    // Corrected item-total correlation: correlation between item j and (total - item j)
    const restTotals = matrix.map(row => row.reduce((a, b, idx) => a + (idx === j ? 0 : b), 0))
    const restMean = restTotals.reduce((a, b) => a + b, 0) / n
    const restVar = n > 1 ? restTotals.reduce((sum, t) => sum + (t - restMean) ** 2, 0) / (n - 1) : 0

    // Correlation
    let cov = 0
    for (let i = 0; i < n; i++) {
      cov += (matrix[i][j] - itemMeans[j]) * (restTotals[i] - restMean)
    }
    cov /= (n - 1)
    const corr = restVar > 0 && itemVars[j] > 0 ? cov / (Math.sqrt(itemVars[j]) * Math.sqrt(restVar)) : 0

    // Alpha if deleted: recompute alpha without item j
    const remainingVars = itemVars.filter((_, idx) => idx !== j)
    const sumRemainingVars = remainingVars.reduce((a, b) => a + b, 0)
    const restTotalVar = restVar
    const alphaIfDeleted = restTotalVar > 0 ? ((k - 1) / (k - 2)) * (1 - sumRemainingVars / restTotalVar) : 0

    itemStats.push({
      item: itemLabels[j],
      mean: Math.round(itemMeans[j] * 100) / 100,
      sd: Math.round(Math.sqrt(itemVars[j]) * 100) / 100,
      itemTotalCorr: Math.round(corr * 1000) / 1000,
      alphaIfDeleted: Math.round(alphaIfDeleted * 1000) / 1000,
    })
  }

  // Interpretation
  const interpretation =
    cronbachAlpha >= 0.9 ? "Sangat baik (Excellent)" :
    cronbachAlpha >= 0.8 ? "Baik (Good)" :
    cronbachAlpha >= 0.7 ? "Cukup (Acceptable)" :
    cronbachAlpha >= 0.6 ? "Dipertanyakan (Questionable)" :
    cronbachAlpha >= 0.5 ? "Buruk (Poor)" : "Tidak dapat diterima (Unacceptable)"

  return NextResponse.json({
    instrument,
    instrumentName: INSTRUMENT_NAMES[instrument],
    n,
    numItems: k,
    cronbachAlpha: Math.round(cronbachAlpha * 1000) / 1000,
    interpretation,
    totalMean: Math.round(totalMean * 100) / 100,
    totalSD: Math.round(Math.sqrt(totalVar) * 100) / 100,
    itemStats,
    ...(instrument === "screentime" ? {
      caveat: "Screen Time bukan skala psikometrik baku/tervalidasi. Cronbach's alpha di sini bersifat eksploratif/deskriptif, bukan bukti validitas instrumen.",
    } : {}),
  })
}
