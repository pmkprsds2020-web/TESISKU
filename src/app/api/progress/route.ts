import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRespondentCookie } from "@/lib/auth"

// GET /api/progress — resume respondent session from cookie
export async function GET() {
  const code = await getRespondentCookie()
  if (!code) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const r = await db.respondent.findUnique({
    where: { code },
    include: {
      demographic: true,
      cesdr: true,
      psqi: true,
      screentime: true,
      mos: true,
      bullying: true,
      religiosity: true,
    },
  })
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json({
    code: r.code,
    school: r.school,
    status: r.status,
    currentStage: r.currentStage,
    stageIndex: r.stageIndex,
    highRisk: r.highRisk,
    consentGiven: r.consentGiven,
    answers: {
      demographic: r.demographic ? JSON.parse(r.demographic.data) : null,
      cesdr: r.cesdr ? JSON.parse(r.cesdr.answers) : null,
      psqi: r.psqi ? JSON.parse(r.psqi.answers) : null,
      screentime: r.screentime ? JSON.parse(r.screentime.answers) : null,
      mos: r.mos ? JSON.parse(r.mos.answers) : null,
      bullying: r.bullying ? JSON.parse(r.bullying.answers) : null,
      religiosity: r.religiosity ? JSON.parse(r.religiosity.answers) : null,
    },
  })
}

// DELETE /api/progress — logout
export async function DELETE() {
  const code = await getRespondentCookie()
  if (code) {
    const r = await db.respondent.findUnique({ where: { code } })
    if (r) {
      await db.auditLog.create({ data: { respondentId: r.id, action: "logout" } })
    }
  }
  const { clearRespondentCookie } = await import("@/lib/auth")
  await clearRespondentCookie()
  return NextResponse.json({ ok: true })
}
