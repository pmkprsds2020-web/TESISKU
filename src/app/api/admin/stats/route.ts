import { NextResponse } from "next/server"
import { db, withDbRetry } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { climateScoreFromBullyingRelation } from "@/lib/scoring"

// GET /api/admin/stats
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    // buildStats() is entirely read-only, so retrying the whole thing once
    // on a transient connection-pool error (see src/lib/db.ts) is safe.
    return await withDbRetry(() => buildStats(admin))
  } catch (e) {
    // Previously an unhandled throw here (e.g. DB connection failure,
    // missing env var, unmigrated schema) made Next.js return a 500 with
    // an empty/HTML body — which the client then failed to JSON.parse
    // ("Unexpected end of JSON input"), masking the real cause. Now the
    // actual error is logged server-side (visible in Vercel function
    // logs) and the client gets a proper JSON error to show/handle.
    console.error("[admin/stats] failed:", e)
    return NextResponse.json(
      { error: "stats_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

async function buildStats(projectId: string) {
  // PERF + CONNECTION-POOL FIX: with DATABASE_URL now correctly set to
  // connection_limit=1 (required for the Supabase transaction pooler under
  // Vercel's serverless concurrency — see src/lib/db.ts), firing 8 queries
  // at once via Promise.all made 7 of them queue for the single available
  // connection and time out (P2024) once the queue exceeded pool_timeout.
  // `db.$transaction([...])` (batch form) sends all of these over ONE
  // connection efficiently instead of each needing its own — which is
  // exactly what connection_limit=1 requires. As a bonus this also makes
  // the whole read a single consistent snapshot instead of 8 independent
  // reads that could race against writes happening in between.
  const since = new Date(Date.now() - 14 * 24 * 3600_000)
  const [
    totalCodes,
    totalRespondents,
    completed,
    inProgress,
    highRisk,
    setting,
    respondents,
    allWithScores,
  ] = await db.$transaction([
    db.researchCode.count({ where: { projectId } }),
    db.respondent.count({ where: { projectId } }),
    db.respondent.count({ where: { projectId, status: "completed" } }),
    db.respondent.count({ where: { projectId, status: "in_progress" } }),
    db.respondent.count({ where: { projectId, highRisk: true } }),
    db.setting.findUnique({ where: { projectId_key: { projectId, key: "targetRespondents" } } }),
    // Per day (last 14 days)
    db.respondent.findMany({
      where: { projectId, startedAt: { gte: since } },
      select: { startedAt: true, status: true, school: true, highRisk: true },
    }),
    // Demographics + scores for completed respondents.
    // NOTE: this replaces what used to be TWO nearly-identical queries here
    // (`completedRespondents` fetching demographic+cesdr, immediately
    // followed by `allWithScores` fetching demographic+cesdr+psqi+mos+
    // bullying+religiosity). The first result was never actually used —
    // it was a dead, redundant full-table query with joins run on every
    // dashboard load. Removed; this single query now covers everything.
    db.respondent.findMany({
      where: { projectId, status: "completed" },
      include: {
        demographic: true,
        cesdr: true,
        psqi: true,
        mos: true,
        bullying: true,
        religiosity: true,
      },
    }),
  ])

  // Target from settings (default 100)
  let targetRespondents = 100
  if (setting) {
    try { targetRespondents = JSON.parse(setting.value) as number } catch { /* keep default */ }
  }

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

  const bySchool: Record<string, number> = {}
  const byGender: Record<string, number> = {}
  const byAge: Record<string, number> = {}
  const byClass: Record<string, number> = {}

  const cesdrScores: number[] = []
  const psqiScores: number[] = []
  const mosScores: number[] = []
  const bullyingScores: number[] = []
  const climateScores: number[] = []
  const religiosityScores: number[] = []

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
    if (r.bullying) bullyingScores.push(r.bullying.victimScore) // GBS (item 1-4)
    const climateVal = climateScoreFromBullyingRelation(r.bullying) // Climate School (item 5-12)
    if (climateVal !== null) climateScores.push(climateVal)
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
  const climateArr: (number | null)[] = allWithScores.map((r) => climateScoreFromBullyingRelation(r.bullying))
  const religArr: (number | null)[] = allWithScores.map((r) => r.religiosity?.totalScore ?? null)

  // PERF: each pair (e.g. cesdr×psqi) was being recomputed twice — once for
  // the flat `correlations.*` fields and again for the `matrix` — and the
  // matrix itself computed each off-diagonal pair twice more (once per
  // triangle). Compute every unique pair exactly once and reuse it.
  const cesdr_psqi = corr(cesdrArr, psqiArr)
  const cesdr_mos = corr(cesdrArr, mosArr)
  const cesdr_bullying = corr(cesdrArr, bullyingArr)
  const cesdr_climate = corr(cesdrArr, climateArr)
  const cesdr_religiosity = corr(cesdrArr, religArr)
  const psqi_mos = corr(psqiArr, mosArr)
  const psqi_bullying = corr(psqiArr, bullyingArr)
  const psqi_climate = corr(psqiArr, climateArr)
  const psqi_religiosity = corr(psqiArr, religArr)
  const mos_bullying = corr(mosArr, bullyingArr)
  const mos_climate = corr(mosArr, climateArr)
  const mos_religiosity = corr(mosArr, religArr)
  const bullying_climate = corr(bullyingArr, climateArr)
  const bullying_religiosity = corr(bullyingArr, religArr)
  const climate_religiosity = corr(climateArr, religArr)

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
      climate: stats(climateScores),
      religiosity: stats(religiosityScores),
    },
    correlations: {
      cesdr_psqi,
      cesdr_mos,
      cesdr_bullying,
      cesdr_climate,
      cesdr_religiosity,
      cesdr_screentime: 0,
      // Full matrix
      matrix: {
        cesdr: { cesdr: 1, psqi: cesdr_psqi, mos: cesdr_mos, bullying: cesdr_bullying, climate: cesdr_climate, religiosity: cesdr_religiosity },
        psqi: { cesdr: cesdr_psqi, psqi: 1, mos: psqi_mos, bullying: psqi_bullying, climate: psqi_climate, religiosity: psqi_religiosity },
        mos: { cesdr: cesdr_mos, psqi: psqi_mos, mos: 1, bullying: mos_bullying, climate: mos_climate, religiosity: mos_religiosity },
        bullying: { cesdr: cesdr_bullying, psqi: psqi_bullying, mos: mos_bullying, bullying: 1, climate: bullying_climate, religiosity: bullying_religiosity },
        climate: { cesdr: cesdr_climate, psqi: psqi_climate, mos: mos_climate, bullying: bullying_climate, climate: 1, religiosity: climate_religiosity },
        religiosity: { cesdr: cesdr_religiosity, psqi: psqi_religiosity, mos: mos_religiosity, bullying: bullying_religiosity, climate: climate_religiosity, religiosity: 1 },
      },
    },
    n: allWithScores.length,
  })
}
