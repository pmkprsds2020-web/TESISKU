import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/reliability
// Body: { instrument: "cesdr"|"mos"|"bullying"|"religiosity" }
// Returns: Cronbach's alpha, item-total correlations, alpha-if-deleted
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { instrument } = await req.json()
  const valid = ["cesdr", "mos", "bullying", "religiosity"]
  if (!valid.includes(instrument)) {
    return NextResponse.json({ error: "Invalid instrument" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { status: "completed" },
    include: {
      cesdr: true,
      mos: true,
      bullying: true,
      religiosity: true,
    },
  })

  // Extract item matrix
  const itemKey = instrument === "cesdr" ? "cesdr" : instrument
  const numItems =
    instrument === "cesdr" ? 20 :
    instrument === "mos" ? 8 :
    instrument === "bullying" ? 8 : 8

  const matrix: number[][] = []
  for (const r of respondents) {
    const ans = r[itemKey as "cesdr" | "mos" | "bullying" | "religiosity"]
    if (!ans) continue
    const parsed = JSON.parse(ans.answers) as Record<string, number>
    const items: number[] = []
    for (let i = 1; i <= numItems; i++) {
      if (parsed[i] !== undefined && parsed[i] !== null) {
        items.push(Number(parsed[i]))
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
  const k = numItems

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
  const itemStats = []
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
      item: j + 1,
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
    instrumentName:
      instrument === "cesdr" ? "CESD-R (Depresi)" :
      instrument === "mos" ? "MOS-SSS (Dukungan Sosial)" :
      instrument === "bullying" ? "Gatehouse Bullying Scale" :
      "Skala Religiusitas",
    n,
    numItems: k,
    cronbachAlpha: Math.round(cronbachAlpha * 1000) / 1000,
    interpretation,
    totalMean: Math.round(totalMean * 100) / 100,
    totalSD: Math.round(Math.sqrt(totalVar) * 100) / 100,
    itemStats,
  })
}
