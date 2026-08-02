import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// GET /api/admin/stats
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const totalCodes = await db.researchCode.count()
  const totalRespondents = await db.respondent.count()
  const completed = await db.respondent.count({ where: { status: "completed" } })
  const inProgress = await db.respondent.count({ where: { status: "in_progress" } })
  const highRisk = await db.respondent.count({ where: { highRisk: true } })

  // Target from settings (default 100)
  let targetRespondents = 100
  const setting = await db.setting.findUnique({ where: { key: "targetRespondents" } })
  if (setting) {
    try { targetRespondents = JSON.parse(setting.value) as number } catch { /* keep default */ }
  }

  // Per day (last 14 days)
  const since = new Date(Date.now() - 14 * 24 * 3600_000)
  const respondents = await db.respondent.findMany({
    where: { startedAt: { gte: since } },
    select: { startedAt: true, status: true, school: true, highRisk: true },
  })
  const perDay: Record<string, { total: number; completed: number }> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600_000)
    const key = d.toISOString().slice(0, 10)
    perDay[key] = { total: 0, completed: 0 }
  }
  for (const r of respondents) {
    const key = r.startedAt.toISOString().slice(0, 10)
    if (perDay[key]) {
      perDay[key].total++
      if (r.status === "completed") perDay[key].completed++
    }
  }

  // Demographics distribution (from completed respondents)
  const completedRespondents = await db.respondent.findMany({
    where: { status: "completed" },
    include: { demographic: true, cesdr: true },
  })

  const bySchool: Record<string, number> = {}
  const byGender: Record<string, number> = {}
  const byAge: Record<string, number> = {}
  const byClass: Record<string, number> = {}

  const cesdrScores: number[] = []
  const psqiScores: number[] = []
  const mosScores: number[] = []
  const bullyingScores: number[] = []
  const religiosityScores: number[] = []

  const allWithScores = await db.respondent.findMany({
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

  for (const r of allWithScores) {
    if (r.demographic) {
      const d = JSON.parse(r.demographic.data) as Record<string, string>
      bySchool[r.school ?? d.school ?? "Tidak diketahui"] = (bySchool[r.school ?? d.school ?? "Tidak diketahui"] ?? 0) + 1
      byGender[d.gender ?? "Tidak diketahui"] = (byGender[d.gender ?? "Tidak diketahui"] ?? 0) + 1
      byAge[String(d.age ?? "?")] = (byAge[String(d.age ?? "?")] ?? 0) + 1
      byClass[d.classGrade ?? "?"] = (byClass[d.classGrade ?? "?"] ?? 0) + 1
    }
    if (r.cesdr) cesdrScores.push(r.cesdr.totalScore)
    if (r.psqi) psqiScores.push(r.psqi.totalScore)
    if (r.mos) mosScores.push(r.mos.totalScore)
    if (r.bullying) bullyingScores.push(r.bullying.victimScore)
    if (r.religiosity) religiosityScores.push(r.religiosity.totalScore)
  }

  const stats = (arr: number[]) => {
    if (arr.length === 0) return { n: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0 }
    const n = arr.length
    const mean = arr.reduce((a, b) => a + b, 0) / n
    const sorted = [...arr].sort((a, b) => a - b)
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    // Sample variance (n-1, Bessel's correction) — matches SPSS default and every
    // other module in this app (cohort, reliability, factor, moderation, cluster).
    // Previously used population variance (÷n), which made SD here silently
    // smaller than the SD for the exact same data shown elsewhere in the dashboard.
    const variance = n > 1 ? arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0
    const sd = Math.sqrt(variance)
    return { n, mean: Math.round(mean * 100) / 100, median, sd: Math.round(sd * 100) / 100, min: sorted[0], max: sorted[n - 1] }
  }

  // Pearson correlation with listwise (pairwise-complete) deletion of missing scores.
  // IMPORTANT: respondents missing either score are EXCLUDED, never treated as 0 —
  // substituting 0 for a missing score would bias the correlation toward/away from
  // zero incorrectly (a missing PSQI score is not the same as "perfect sleep quality = 0").
  function corr(a: (number | null)[], b: (number | null)[]) {
    const pairs: [number, number][] = []
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const av = a[i]
      const bv = b[i]
      if (av !== null && bv !== null && av !== undefined && bv !== undefined) {
        pairs.push([av, bv])
      }
    }
    const n = pairs.length
    if (n < 2) return 0
    const ma = pairs.reduce((s, p) => s + p[0], 0) / n
    const mb = pairs.reduce((s, p) => s + p[1], 0) / n
    let num = 0, da = 0, db = 0
    for (const [x, y] of pairs) {
      num += (x - ma) * (y - mb)
      da += (x - ma) ** 2
      db += (y - mb) ** 2
    }
    const den = Math.sqrt(da * db)
    return den === 0 ? 0 : Math.round((num / den) * 100) / 100
  }

  // build aligned arrays by respondent order — missing scores stay `null`,
  // NOT defaulted to 0, so corr() can correctly exclude them pairwise.
  const cesdrArr: (number | null)[] = allWithScores.map((r) => r.cesdr?.totalScore ?? null)
  const psqiArr: (number | null)[] = allWithScores.map((r) => r.psqi?.totalScore ?? null)
  const mosArr: (number | null)[] = allWithScores.map((r) => r.mos?.totalScore ?? null)
  const bullyingArr: (number | null)[] = allWithScores.map((r) => r.bullying?.victimScore ?? null)
  const religArr: (number | null)[] = allWithScores.map((r) => r.religiosity?.totalScore ?? null)

  return NextResponse.json({
    overview: {
      totalCodes,
      totalRespondents,
      completed,
      inProgress,
      highRisk,
      targetRespondents,
      completionRate: totalRespondents > 0 ? Math.round((completed / totalRespondents) * 100) : 0,
      targetProgress: targetRespondents > 0 ? Math.round((completed / targetRespondents) * 100) : 0,
    },
    perDay: Object.entries(perDay).map(([date, v]) => ({ date, ...v })),
    distribution: {
      bySchool: Object.entries(bySchool).map(([k, v]) => ({ label: k, value: v })),
      byGender: Object.entries(byGender).map(([k, v]) => ({ label: k, value: v })),
      byAge: Object.entries(byAge).map(([k, v]) => ({ label: k, value: v })),
      byClass: Object.entries(byClass).map(([k, v]) => ({ label: k, value: v })),
    },
    descriptive: {
      cesdr: stats(cesdrScores),
      psqi: stats(psqiScores),
      mos: stats(mosScores),
      bullying: stats(bullyingScores),
      religiosity: stats(religiosityScores),
    },
    correlations: {
      cesdr_psqi: corr(cesdrArr, psqiArr),
      cesdr_mos: corr(cesdrArr, mosArr),
      cesdr_bullying: corr(cesdrArr, bullyingArr),
      cesdr_religiosity: corr(cesdrArr, religArr),
      cesdr_screentime: 0,
      // Full matrix
      matrix: {
        cesdr: { cesdr: 1, psqi: corr(cesdrArr, psqiArr), mos: corr(cesdrArr, mosArr), bullying: corr(cesdrArr, bullyingArr), religiosity: corr(cesdrArr, religArr) },
        psqi: { cesdr: corr(cesdrArr, psqiArr), psqi: 1, mos: corr(psqiArr, mosArr), bullying: corr(psqiArr, bullyingArr), religiosity: corr(psqiArr, religArr) },
        mos: { cesdr: corr(cesdrArr, mosArr), psqi: corr(psqiArr, mosArr), mos: 1, bullying: corr(mosArr, bullyingArr), religiosity: corr(mosArr, religArr) },
        bullying: { cesdr: corr(cesdrArr, bullyingArr), psqi: corr(psqiArr, bullyingArr), mos: corr(mosArr, bullyingArr), bullying: 1, religiosity: corr(bullyingArr, religArr) },
        religiosity: { cesdr: corr(cesdrArr, religArr), psqi: corr(psqiArr, religArr), mos: corr(mosArr, religArr), bullying: corr(bullyingArr, religArr), religiosity: 1 },
      },
    },
    n: allWithScores.length,
  })
}
