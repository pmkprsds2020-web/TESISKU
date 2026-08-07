import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { setRespondentCookieOnResponse, encodeRespondentCookieValue } from "@/lib/auth"
import { getOrCreateProjectForIdentity } from "@/lib/project"
import { syncRespondent, syncResearchCode, syncResearchCodeUsed, syncAuditLog } from "@/lib/supabase-sync"

// POST /api/login  { code: "SMP001001" }
//
// Multi-tenant note: research codes are unique PER PROJECT, not globally,
// so a respondent code is looked up across all projects and whichever
// project it belongs to becomes this respondent's session — the
// respondent never needs to know which researcher/project they belong
// to, they just use the code they were given.
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    const clean = String(code ?? "").trim().toUpperCase()

    if (!clean) {
      return NextResponse.json({ error: "Kode penelitian wajib diisi." }, { status: 400 })
    }

    // Admin shortcut
    if (clean === "ADMIN") {
      return NextResponse.json({ admin: true })
    }

    // Validate code format or existence — look up across all projects,
    // since a respondent only knows their code, not which researcher's
    // project issued it.
    let rc = await db.researchCode.findFirst({ where: { code: clean } })

    // Auto-create code if it matches SMP pattern. Historically (single-
    // tenant) this created a code with no owner; now it's attached to the
    // legacy/default project so it doesn't float around ownerless.
    if (!rc && /^SMP\d{6,}$/.test(clean)) {
      const legacyProject = await getOrCreateProjectForIdentity({ kind: "legacy", username: "admin" })
      rc = await db.researchCode.create({ data: { code: clean, projectId: legacyProject.id } })
    }

    if (!rc) {
      return NextResponse.json(
        { error: "Kode penelitian tidak ditemukan. Periksa kembali kode Anda." },
        { status: 404 }
      )
    }

    const projectId = rc.projectId

    // Sync research code to Supabase
    await syncResearchCode(clean, rc.school, rc.classGrade)

    // Find or create respondent, scoped to this code's project
    let respondent = await db.respondent.findUnique({ where: { projectId_code: { projectId, code: clean } } })
    if (!respondent) {
      respondent = await db.respondent.create({
        data: {
          projectId,
          code: clean,
          school: rc.school,
          status: "in_progress",
          currentStage: "consent",
        },
      })
      await db.auditLog.create({
        data: { projectId, respondentId: respondent.id, action: "login", detail: `Login dengan kode ${clean}` },
      })
      // Mark code as used in Supabase
      await syncResearchCodeUsed(clean, true)
    } else {
      await db.auditLog.create({
        data: { projectId, respondentId: respondent.id, action: "login", detail: "Resume sesi" },
      })
    }

    // Sync respondent to Supabase (uses code as key, not id)
    await syncRespondent({
      code: respondent.code,
      school: respondent.school,
      status: respondent.status,
      current_stage: respondent.currentStage,
      stage_index: respondent.stageIndex,
      high_risk: respondent.highRisk,
      consent_given: respondent.consentGiven,
      started_at: respondent.startedAt.toISOString(),
      completed_at: respondent.completedAt?.toISOString() ?? null,
    })
    // Sync audit log (uses code to find UUID in Supabase)
    await syncAuditLog(respondent.code, "login", `Login dengan kode ${clean}`)

    const response = NextResponse.json({
      code: clean,
      school: rc.school,
      status: respondent.status,
      currentStage: respondent.currentStage,
      stageIndex: respondent.stageIndex,
      highRisk: respondent.highRisk,
      consentGiven: respondent.consentGiven,
      respondentId: respondent.id,
    })
    setRespondentCookieOnResponse(response, encodeRespondentCookieValue(projectId, clean))
    return response
  } catch (e) {
    console.error("[login]", e)
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
  }
}
