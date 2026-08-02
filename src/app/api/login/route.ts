import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { setRespondentCookie } from "@/lib/auth"
import { syncRespondent, syncResearchCode, syncResearchCodeUsed, syncAuditLog } from "@/lib/supabase-sync"

// POST /api/login  { code: "SMP001001" }
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

    // Validate code format or existence
    let rc = await db.researchCode.findUnique({ where: { code: clean } })

    // Auto-create code if it matches SMP pattern
    if (!rc && /^SMP\d{6,}$/.test(clean)) {
      rc = await db.researchCode.create({ data: { code: clean } })
    }

    if (!rc) {
      return NextResponse.json(
        { error: "Kode penelitian tidak ditemukan. Periksa kembali kode Anda." },
        { status: 404 }
      )
    }

    // Sync research code to Supabase
    await syncResearchCode(clean, rc.school, rc.classGrade)

    // Find or create respondent
    let respondent = await db.respondent.findUnique({ where: { code: clean } })
    if (!respondent) {
      respondent = await db.respondent.create({
        data: {
          code: clean,
          school: rc.school,
          status: "in_progress",
          currentStage: "consent",
        },
      })
      await db.auditLog.create({
        data: { respondentId: respondent.id, action: "login", detail: `Login dengan kode ${clean}` },
      })
      // Mark code as used in Supabase
      await syncResearchCodeUsed(clean, true)
    } else {
      await db.auditLog.create({
        data: { respondentId: respondent.id, action: "login", detail: "Resume sesi" },
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

    await setRespondentCookie(clean)

    return NextResponse.json({
      code: clean,
      school: rc.school,
      status: respondent.status,
      currentStage: respondent.currentStage,
      stageIndex: respondent.stageIndex,
      highRisk: respondent.highRisk,
      consentGiven: respondent.consentGiven,
      respondentId: respondent.id,
    })
  } catch (e) {
    console.error("[login]", e)
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
  }
}
