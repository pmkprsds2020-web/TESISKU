import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/compare — get scores for multiple respondents for comparison
// Body: { codes: ["SMP001001", "SMP001002", ...] }
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { codes } = await req.json()
  if (!Array.isArray(codes) || codes.length < 2) {
    return NextResponse.json({ error: "Minimal 2 responden untuk perbandingan" }, { status: 400 })
  }
  if (codes.length > 6) {
    return NextResponse.json({ error: "Maksimal 6 responden untuk perbandingan" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { code: { in: codes } },
    include: {
      demographic: true,
      cesdr: true,
      psqi: true,
      mos: true,
      bullying: true,
      religiosity: true,
    },
  })

  const result = respondents.map((r) => {
    const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
    return {
      code: r.code,
      school: r.school,
      highRisk: r.highRisk,
      status: r.status,
      gender: demo.gender ?? "?",
      age: demo.age ?? "?",
      classGrade: demo.classGrade ?? "?",
      scores: {
        cesdr: r.cesdr?.totalScore ?? null,
        psqi: r.psqi?.totalScore ?? null,
        mos: r.mos?.totalScore ?? null,
        bullying: r.bullying?.victimScore ?? null,
        religiosity: r.religiosity?.totalScore ?? null,
      },
    }
  })

  return NextResponse.json({ respondents: result })
}
