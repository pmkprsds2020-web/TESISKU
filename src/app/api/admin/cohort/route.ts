import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/cohort
// Body: { groupBy: "school"|"gender"|"age"|"classGrade", metric: "cesdr"|"psqi"|"mos"|"bullying"|"religiosity" }
// Returns: group stats (n, mean, sd, se) + significance test (t-test for 2 groups, ANOVA for 3+)
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { groupBy, metric } = await req.json()
  const validGroupBy = ["school", "gender", "age", "classGrade"]
  const validMetrics = ["cesdr", "psqi", "mos", "bullying", "religiosity"]

  if (!validGroupBy.includes(groupBy) || !validMetrics.includes(metric)) {
    return NextResponse.json({ error: "Invalid groupBy or metric" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { status: "completed" },
    include: {
      demographic: true,
      cesdr: true,
      psqi: true,
      mos: true,
      bullying: true,
      religiosity: true,
    },
  })

  // Extract score per respondent
  const getScore = (r: typeof respondents[number]): number | null => {
    switch (metric) {
      case "cesdr": return r.cesdr?.totalScore ?? null
      case "psqi": return r.psqi?.totalScore ?? null
      case "mos": return r.mos?.totalScore ?? null
      case "bullying": return r.bullying?.victimScore ?? null
      case "religiosity": return r.religiosity?.totalScore ?? null
      default: return null
    }
  }

  const getGroup = (r: typeof respondents[number]): string => {
    const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
    if (groupBy === "school") return r.school ?? demo.school ?? "Tidak diketahui"
    return demo[groupBy] ?? "Tidak diketahui"
  }

  // Group scores
  const groups: Record<string, number[]> = {}
  for (const r of respondents) {
    const score = getScore(r)
    if (score === null) continue
    const group = getGroup(r)
    if (!groups[group]) groups[group] = []
    groups[group].push(score)
  }

  // Compute group stats
  const groupStats = Object.entries(groups).map(([name, scores]) => {
    const n = scores.length
    const mean = scores.reduce((a, b) => a + b, 0) / n
    const variance = n > 1 ? scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0
    const sd = Math.sqrt(variance)
    const se = sd / Math.sqrt(n)
    return {
      name,
      n,
      mean: Math.round(mean * 100) / 100,
      sd: Math.round(sd * 100) / 100,
      se: Math.round(se * 100) / 100,
      min: Math.min(...scores),
      max: Math.max(...scores),
      scores,
    }
  }).filter(g => g.n > 0).sort((a, b) => b.n - a.n)

  // Significance test
  let significance: {
    test: string
    statistic: number
    pValue: number
    significant: boolean
    description: string
    effectSize?: { name: string; value: number; interpretation: string }
    postHoc?: { pairs: { groups: [string, string]; meanDiff: number; pValue: number; significant: boolean }[]; test: string }
  } | null = null

  if (groupStats.length === 2 && groupStats[0].n > 1 && groupStats[1].n > 1) {
    // Independent samples t-test (Welch's)
    const g1 = groupStats[0]
    const g2 = groupStats[1]
    const t = (g1.mean - g2.mean) / Math.sqrt(g1.scores.reduce((a, b) => a + (b - g1.mean) ** 2, 0) / (g1.n * (g1.n - 1)) + g2.scores.reduce((a, b) => a + (b - g2.mean) ** 2, 0) / (g2.n * (g2.n - 1)))
    // Welch-Satterthwaite df
    const num = Math.pow(g1.sd ** 2 / g1.n + g2.sd ** 2 / g2.n, 2)
    const den = Math.pow(g1.sd ** 2 / g1.n, 2) / (g1.n - 1) + Math.pow(g2.sd ** 2 / g2.n, 2) / (g2.n - 1)
    const df = num / den
    // Approximate p-value using normal distribution (simplified for large df)
    const pValue = 2 * (1 - normalCDF(Math.abs(t)))

    // Cohen's d effect size (pooled SD)
    const pooledSD = Math.sqrt(((g1.n - 1) * g1.sd ** 2 + (g2.n - 1) * g2.sd ** 2) / (g1.n + g2.n - 2))
    const cohensD = pooledSD > 0 ? (g1.mean - g2.mean) / pooledSD : 0
    const dInterpretation = Math.abs(cohensD) < 0.2 ? "Sangat kecil" : Math.abs(cohensD) < 0.5 ? "Kecil" : Math.abs(cohensD) < 0.8 ? "Sedang" : "Besar"

    significance = {
      test: "Independent Samples t-test (Welch's)",
      statistic: Math.round(t * 1000) / 1000,
      pValue: Math.round(pValue * 10000) / 10000,
      significant: pValue < 0.05,
      description: `t(${Math.round(df)}) = ${Math.round(t * 1000) / 1000}, p = ${pValue < 0.001 ? "<0.001" : Math.round(pValue * 10000) / 10000}. ${pValue < 0.05 ? "Perbedaan signifikan" : "Tidak ada perbedaan signifikan"} pada α=0.05.`,
      effectSize: { name: "Cohen's d", value: Math.round(cohensD * 1000) / 1000, interpretation: dInterpretation },
    }
  } else if (groupStats.length >= 3) {
    // One-way ANOVA
    const allScores = groupStats.flatMap(g => g.scores)
    const grandMean = allScores.reduce((a, b) => a + b, 0) / allScores.length
    const N = allScores.length
    const k = groupStats.length

    const ssBetween = groupStats.reduce((sum, g) => sum + g.n * Math.pow(g.mean - grandMean, 2), 0)
    const ssWithin = groupStats.reduce((sum, g) => sum + g.scores.reduce((s, x) => s + Math.pow(x - g.mean, 2), 0), 0)
    const ssTotal = ssBetween + ssWithin

    const msBetween = ssBetween / (k - 1)
    const msWithin = ssWithin / (N - k)
    const f = msWithin > 0 ? msBetween / msWithin : 0

    // Approximate p-value using F distribution (simplified)
    const pValue = fDistPValue(f, k - 1, N - k)

    // Eta-squared effect size
    const etaSquared = ssTotal > 0 ? ssBetween / ssTotal : 0
    const etaInterpretation = etaSquared < 0.01 ? "Sangat kecil" : etaSquared < 0.06 ? "Kecil" : etaSquared < 0.14 ? "Sedang" : "Besar"

    // Post-hoc Tukey HSD with Bonferroni correction (only if significant)
    let postHoc: { pairs: { groups: [string, string]; meanDiff: number; pValue: number; pAdj: number; significant: boolean }[]; test: string; correction: string } | undefined
    if (pValue < 0.05) {
      const pairs: { groups: [string, string]; meanDiff: number; pValue: number; pAdj: number; significant: boolean }[] = []
      const numComparisons = (groupStats.length * (groupStats.length - 1)) / 2
      for (let i = 0; i < groupStats.length; i++) {
        for (let j = i + 1; j < groupStats.length; j++) {
          const gi = groupStats[i]
          const gj = groupStats[j]
          const meanDiff = Math.abs(gi.mean - gj.mean)
          const se = Math.sqrt(msWithin * (1 / gi.n + 1 / gj.n) / 2)
          const q = se > 0 ? meanDiff / se : 0
          const pVal = 2 * (1 - normalCDF(q * Math.sqrt(2)))
          // Bonferroni correction: p_adj = min(p * numComparisons, 1)
          const pAdj = Math.min(pVal * numComparisons, 1)
          pairs.push({
            groups: [gi.name, gj.name],
            meanDiff: Math.round((gi.mean - gj.mean) * 100) / 100,
            pValue: Math.round(pVal * 10000) / 10000,
            pAdj: Math.round(pAdj * 10000) / 10000,
            significant: pAdj < 0.05,
          })
        }
      }
      postHoc = { pairs, test: "Tukey HSD", correction: "Bonferroni" }
    }

    significance = {
      test: "One-way ANOVA",
      statistic: Math.round(f * 1000) / 1000,
      pValue: Math.round(pValue * 10000) / 10000,
      significant: pValue < 0.05,
      description: `F(${k - 1}, ${N - k}) = ${Math.round(f * 1000) / 1000}, p = ${pValue < 0.001 ? "<0.001" : Math.round(pValue * 10000) / 10000}. ${pValue < 0.05 ? "Perbedaan signifikan" : "Tidak ada perbedaan signifikan"} pada α=0.05.`,
      effectSize: { name: "Eta-squared (η²)", value: Math.round(etaSquared * 1000) / 1000, interpretation: etaInterpretation },
      postHoc,
    }
  }

  return NextResponse.json({
    groupBy,
    metric,
    groups: groupStats.map(g => ({
      name: g.name,
      n: g.n,
      mean: g.mean,
      sd: g.sd,
      se: g.se,
      min: g.min,
      max: g.max,
    })),
    significance,
  })
}

// Standard normal CDF approximation (Abramowitz & Stegun)
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

// F-distribution p-value approximation
function fDistPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1
  // Use the relationship with incomplete beta function
  const x = df2 / (df2 + df1 * f)
  return incompleteBeta(df2 / 2, df1 / 2, x)
}

// Incomplete beta function (continued fraction approximation)
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lbeta = Math.log(x) * a + Math.log(1 - x) * b - Math.log(a + b) - logGamma(a) - logGamma(b) + logGamma(a + b)
  const front = Math.exp(lbeta) / a
  // Lentz's algorithm for continued fraction
  let f = 1
  let c = 1
  let d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  f = d
  for (let m = 1; m <= 100; m++) {
    const m2 = 2 * m
    const aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    f *= d * c
    const bb = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1))
    d = 1 + bb * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + bb / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const delta = d * c
    f *= delta
    if (Math.abs(delta - 1) < 1e-10) break
  }
  return front * f
}

// Lanczos approximation for log gamma
function logGamma(x: number): number {
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  }
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i)
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
