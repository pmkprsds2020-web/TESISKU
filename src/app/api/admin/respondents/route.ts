import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// GET /api/admin/respondents
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const list = await db.respondent.findMany({
    where: { projectId: admin },
    orderBy: { startedAt: "desc" },
    include: {
      demographic: true,
      cesdr: true,
      psqi: true,
      screentime: true,
      mos: true,
      bullying: true,
      religiosity: true,
    },
    take: 500,
  })

  const rows = list.map((r) => {
    const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
    const cesdr = r.cesdr ? (JSON.parse(r.cesdr.answers) as Record<string, number>) : {}
    return {
      code: r.code,
      school: r.school ?? demo.school ?? "",
      status: r.status,
      highRisk: r.highRisk,
      consentGiven: r.consentGiven,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      demographic: demo,
      scores: {
        cesdr: r.cesdr?.totalScore ?? null,
        psqi: r.psqi?.totalScore ?? null,
        mos: r.mos?.totalScore ?? null,
        bullying: r.bullying?.victimScore ?? null,
        religiosity: r.religiosity?.totalScore ?? null,
      },
      cesdrItem18: cesdr["18"] ?? null,
    }
  })

  return NextResponse.json({ respondents: rows })
}
