import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { scorePsqi, scoreClimateSchool } from "@/lib/scoring"
import { buildScreeningAnalysis, buildConclusion, buildClinicalNarrative, buildRecommendations } from "@/lib/interpretation"

// GET /api/admin/respondent?code=SMP001001 — full detail incl. audit logs
export async function GET(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })

  const r = await db.respondent.findUnique({
    where: { projectId_code: { projectId: admin, code } },
    include: {
      demographic: true,
      cesdr: true,
      psqi: true,
      screentime: true,
      mos: true,
      bullying: true,
      religiosity: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  })
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
  const cesdr = r.cesdr ? (JSON.parse(r.cesdr.answers) as Record<string, number>) : {}
  const psqi = r.psqi ? (JSON.parse(r.psqi.answers) as Record<string, string | number>) : {}
  const screentime = r.screentime ? (JSON.parse(r.screentime.answers) as Record<string, number>) : {}
  const mos = r.mos ? (JSON.parse(r.mos.answers) as Record<string, number>) : {}
  const bullying = r.bullying ? (JSON.parse(r.bullying.answers) as Record<string, number>) : {}
  const religiosity = r.religiosity ? (JSON.parse(r.religiosity.answers) as Record<string, number>) : {}

  // Re-derive the PSQI component breakdown (C1-C7) from the raw stored answers
  // for display purposes. Does not overwrite the persisted totalScore.
  const psqiBreakdown = r.psqi ? scorePsqi(psqi) : null

  // Climate School (item 5-12 of the `bullying` answers) is not stored as its
  // own DB column — it's derived live from the raw answers, same pattern as
  // psqiBreakdown above, so it's always in sync with the current scoring logic.
  const climateSchool = r.bullying ? scoreClimateSchool(bullying) : null

  const analysis = buildScreeningAnalysis({
    cesdr: r.cesdr?.totalScore ?? null,
    cesdrHighRisk: r.cesdr?.highRisk ?? false,
    psqi: r.psqi?.totalScore ?? null,
    mos: r.mos?.totalScore ?? null,
    gbs: r.bullying?.victimScore ?? null,
    bullyingAnswers: r.bullying ? bullying : null,
    religiosity: r.religiosity?.totalScore ?? null,
  })
  const conclusion = buildConclusion(analysis)
  const clinicalNarrative = buildClinicalNarrative(analysis)
  const recommendations = buildRecommendations(analysis)

  return NextResponse.json({
    respondent: {
      code: r.code,
      school: r.school,
      status: r.status,
      currentStage: r.currentStage,
      stageIndex: r.stageIndex,
      highRisk: r.highRisk,
      consentGiven: r.consentGiven,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      demographic: demo,
      answers: {
        cesdr,
        psqi,
        screentime,
        mos,
        bullying,
        religiosity,
      },
      scores: {
        cesdr: r.cesdr?.totalScore ?? null,
        psqi: r.psqi?.totalScore ?? null,
        mos: r.mos?.totalScore ?? null,
        bullying: r.bullying?.victimScore ?? null, // GBS (item 1-4) saja
        climateSchool: climateSchool?.total ?? null,
        religiosity: r.religiosity?.totalScore ?? null,
      },
      psqiBreakdown: psqiBreakdown && {
        components: psqiBreakdown.components,
        poorSleepQuality: psqiBreakdown.poorSleepQuality,
        limitations: psqiBreakdown.limitations,
      },
      climateSchool,
      analysis,
      conclusion,
      clinicalNarrative,
      recommendations,
      cesdrItem18: cesdr["18"] ?? null,
      auditLogs: r.auditLogs.map((l) => ({
        action: l.action,
        detail: l.detail,
        createdAt: l.createdAt,
      })),
    },
  })
}
