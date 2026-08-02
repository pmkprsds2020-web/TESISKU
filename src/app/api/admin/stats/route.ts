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
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    const sd = Math.sqrt(variance)
    return { n, mean: Math.round(mean * 100) / 100, median, sd: Math.round(sd * 100) / 100, min: sorted[0], max: sorted[n - 1] }
  }

  // Simple correlation between CESD-R and other scores
  function corr(a: number[], b: number[]) {
    const n = Math.min(a.length, b.length)
    if (n < 2) return 0
    const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n
    const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n
    let num = 0, da = 0, db = 0
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb)
      da += (a[i] - ma) ** 2
      db += (b[i] - mb) ** 2
    }
    const den = Math.sqrt(da * db)
    return den === 0 ? 0 : Math.round((num / den) * 100) / 100
  }

  // build aligned arrays by respondent order
  const cesdrArr = allWithScores.map((r) => r.cesdr?.totalScore ?? 0)
  const psqiArr = allWithScores.map((r) => r.psqi?.totalScore ?? 0)
  const mosArr = allWithScores.map((r) => r.mos?.totalScore ?? 0)
  const bullyingArr = allWithScores.map((r) => r.bullying?.victimScore ?? 0)
  const religArr = allWithScores.map((r) => r.religiosity?.totalScore ?? 0)

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
