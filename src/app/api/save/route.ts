import { NextRequest, NextResponse } from "next/server"
import { db, withDbRetry } from "@/lib/db"
import { getRespondentCookie } from "@/lib/auth"
import { scoreCesdr, scorePsqi, scoreMos, scoreBullying, scoreReligiosity } from "@/lib/scoring"
import { CESDR_HIGH_RISK_ITEM, CESDR_HIGH_RISK_THRESHOLD, StageId } from "@/lib/instruments"
import {
  syncRespondent, syncDemographics, syncCesdrAnswers, syncPsqiAnswers,
  syncScreentimeAnswers, syncMosAnswers, syncBullyingAnswers, syncReligiosityAnswers,
  syncAuditLog,
} from "@/lib/supabase-sync"

type SaveBody = {
  stage: StageId | "consent"
  answers: Record<string, unknown>
  stageIndex?: number
  complete?: boolean
}

// PERF (audit finding): every Supabase mirror write in this route used to be
// `await`-ed, meaning the HTTP response to the browser waited on a network
// round trip to Supabase's REST API on top of the actual Postgres write via
// Prisma. Since nothing in this app reads the mirrored Supabase tables (see
// src/lib/supabase-sync.ts), there is no correctness reason to block the
// response on them. `fireAndForget` starts the write and lets the response
// return immediately; failures are still logged, just asynchronously.
function fireAndForget(p: Promise<unknown>) {
  p.catch((err) => console.error("[save] background sync failed:", err))
}

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") console.log(...args)
}

// Helper: sync respondent to Supabase after any update (uses code, not id).
// Non-blocking by design — callers should NOT await this on the response path.
function syncRespondentToSupabase(r: Awaited<ReturnType<typeof db.respondent.findUnique>>, overrides?: Record<string, unknown>) {
  if (!r) return
  fireAndForget(syncRespondent({
    code: r.code,
    school: r.school,
    status: (overrides?.status as string) ?? r.status,
    current_stage: (overrides?.currentStage as string) ?? r.currentStage,
    stage_index: (overrides?.stageIndex as number) ?? r.stageIndex,
    high_risk: (overrides?.highRisk as boolean) ?? r.highRisk,
    consent_given: (overrides?.consentGiven as boolean) ?? r.consentGiven,
    started_at: r.startedAt.toISOString(),
    completed_at: r.completedAt?.toISOString() ?? null,
  }))
}

// POST /api/save — stage completion (Lanjut button on last question)
export async function POST(req: NextRequest) {
  const code = await getRespondentCookie()
  if (!code) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const body = (await req.json()) as SaveBody
  const { stage, answers, stageIndex, complete } = body
  devLog("[save/POST] stage:", stage, "code:", code, "answers keys:", Object.keys(answers ?? {}).length)

  // Retry: this is the very first DB call on every save request and is
  // read-only (safe to retry) — the most common place the pooler-exhaustion
  // errors surfaced in production logs.
  const r = await withDbRetry(() => db.respondent.findUnique({ where: { code } }))
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const next: Partial<{ currentStage: string; stageIndex: number; status: string; highRisk: boolean; consentGiven: boolean; completedAt: Date }> = {}

  // ─── Consent ──────────────────────────────────────────────────────
  if (stage === "consent") {
    next.consentGiven = true
    next.currentStage = "demographics"
    next.stageIndex = 0
    await db.auditLog.create({ data: { respondentId: r.id, action: "stage_complete", detail: "consent" } })
    fireAndForget(syncAuditLog(r.code, "stage_complete", "consent"))

  // ─── Demographics ─────────────────────────────────────────────────
  } else if (stage === "demographics") {
    const data = JSON.stringify(answers)
    next.currentStage = "cesdr"
    next.stageIndex = 0
    // CONNECTION-POOL FIX: these two writes touch different tables and
    // don't depend on each other's result. They used to run via
    // Promise.all (concurrent), but under connection_limit=1 (required for
    // the Supabase transaction pooler — see src/lib/db.ts) that meant one
    // of them had to queue for the single available connection instead of
    // actually running in parallel. db.$transaction sends both over one
    // connection efficiently, and atomically (both succeed or neither does).
    await db.$transaction([
      db.demographic.upsert({
        where: { respondentId: r.id },
        update: { data },
        create: { respondentId: r.id, data },
      }),
      db.auditLog.create({ data: { respondentId: r.id, action: "stage_complete", detail: "demographics" } }),
    ])
    // Sync to Supabase (data stored as jsonb object, not string)
    fireAndForget(syncDemographics(r.code, answers))
    fireAndForget(syncAuditLog(r.code, "stage_complete", "demographics"))

  // ─── CESD-R ───────────────────────────────────────────────────────
  } else if (stage === "cesdr") {
    const a = answers as Record<number, number>
    const { total, highRisk } = scoreCesdr(a)
    const json = JSON.stringify(a)
    await db.cesdrAnswer.upsert({
      where: { respondentId: r.id },
      update: { answers: json, totalScore: total, highRisk },
      create: { respondentId: r.id, answers: json, totalScore: total, highRisk },
    })
    // Sync to Supabase
    fireAndForget(syncCesdrAnswers(r.code, a, total, highRisk))
    if (highRisk && !r.highRisk) {
      next.highRisk = true
      await db.auditLog.create({ data: { respondentId: r.id, action: "high_risk_flag", detail: `CESD-R item ${CESDR_HIGH_RISK_ITEM} >= ${CESDR_HIGH_RISK_THRESHOLD}` } })
      fireAndForget(syncAuditLog(r.code, "high_risk_flag", `CESD-R item ${CESDR_HIGH_RISK_ITEM} >= ${CESDR_HIGH_RISK_THRESHOLD}`))
    }
    next.currentStage = "psqi"
    next.stageIndex = 0
    await db.auditLog.create({ data: { respondentId: r.id, action: "stage_complete", detail: "cesdr" } })
    fireAndForget(syncAuditLog(r.code, "stage_complete", "cesdr"))

  // ─── PSQI ─────────────────────────────────────────────────────────
  } else if (stage === "psqi") {
    const a = answers as Record<string, number | string>
    const { total } = scorePsqi(a)
    const json = JSON.stringify(a)
    next.currentStage = "screentime"
    next.stageIndex = 0
    await db.$transaction([
      db.psqiAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json, totalScore: total },
        create: { respondentId: r.id, answers: json, totalScore: total },
      }),
      db.auditLog.create({ data: { respondentId: r.id, action: "stage_complete", detail: "psqi" } }),
    ])
    // Sync to Supabase
    fireAndForget(syncPsqiAnswers(r.code, a, total))
    fireAndForget(syncAuditLog(r.code, "stage_complete", "psqi"))

  // ─── Screen Time ──────────────────────────────────────────────────
  } else if (stage === "screentime") {
    const json = JSON.stringify(answers)
    next.currentStage = "mos"
    next.stageIndex = 0
    await db.$transaction([
      db.screenTimeAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json },
        create: { respondentId: r.id, answers: json },
      }),
      db.auditLog.create({ data: { respondentId: r.id, action: "stage_complete", detail: "screentime" } }),
    ])
    // Sync to Supabase
    fireAndForget(syncScreentimeAnswers(r.code, answers))
    fireAndForget(syncAuditLog(r.code, "stage_complete", "screentime"))

  // ─── MOS-SSS ──────────────────────────────────────────────────────
  } else if (stage === "mos") {
    const a = answers as Record<number, number>
    const total = scoreMos(a)
    const json = JSON.stringify(a)
    next.currentStage = "bullying"
    next.stageIndex = 0
    await db.$transaction([
      db.mosAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json, totalScore: total },
        create: { respondentId: r.id, answers: json, totalScore: total },
      }),
      db.auditLog.create({ data: { respondentId: r.id, action: "stage_complete", detail: "mos" } }),
    ])
    // Sync to Supabase
    fireAndForget(syncMosAnswers(r.code, a, total))
    fireAndForget(syncAuditLog(r.code, "stage_complete", "mos"))

  // ─── Bullying ─────────────────────────────────────────────────────
  } else if (stage === "bullying") {
    const a = answers as Record<number, number>
    const total = scoreBullying(a)
    const json = JSON.stringify(a)
    next.currentStage = "religiosity"
    next.stageIndex = 0
    await db.$transaction([
      db.bullyingAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json, victimScore: total },
        create: { respondentId: r.id, answers: json, victimScore: total },
      }),
      db.auditLog.create({ data: { respondentId: r.id, action: "stage_complete", detail: "bullying" } }),
    ])
    // Sync to Supabase
    fireAndForget(syncBullyingAnswers(r.code, a, total))
    fireAndForget(syncAuditLog(r.code, "stage_complete", "bullying"))

  // ─── Religiosity ──────────────────────────────────────────────────
  } else if (stage === "religiosity") {
    const a = answers as Record<number, number>
    const total = scoreReligiosity(a)
    const json = JSON.stringify(a)
    await db.religiosityAnswer.upsert({
      where: { respondentId: r.id },
      update: { answers: json, totalScore: total },
      create: { respondentId: r.id, answers: json, totalScore: total },
    })
    // Sync to Supabase
    fireAndForget(syncReligiosityAnswers(r.code, a, total))
    next.currentStage = "complete"
    next.stageIndex = 0
    next.status = "completed"
    next.completedAt = new Date()
    await db.auditLog.create({ data: { respondentId: r.id, action: "complete", detail: "Penelitian selesai" } })
    fireAndForget(syncAuditLog(r.code, "complete", "Penelitian selesai"))
  }

  // Auto-save mid-stage: update stageIndex without advancing
  if (stageIndex !== undefined && !complete) {
    // For intermediate autosave we update index but keep current stage
  }

  await db.respondent.update({
    where: { id: r.id },
    data: next,
  })

  // Sync respondent to Supabase after update
  syncRespondentToSupabase(r, next)

  return NextResponse.json({ ok: true, ...next })
}

// PATCH /api/save — autosave mid-stage (draft save when user clicks an answer)
export async function PATCH(req: NextRequest) {
  const code = await getRespondentCookie()
  if (!code) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const body = await req.json()
  const { stageIndex, stage, answers } = body
  devLog("[save/PATCH] stage:", stage, "code:", code, "stageIndex:", stageIndex, "answers keys:", Object.keys(answers ?? {}).length)

  // Retry: this is the very first DB call on every save request and is
  // read-only (safe to retry) — the most common place the pooler-exhaustion
  // errors surfaced in production logs.
  const r = await withDbRetry(() => db.respondent.findUnique({ where: { code } }))
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // Persist partial answers for the current stage (true mid-stage persistence)
  if (stage && answers) {
    const json = JSON.stringify(answers)
    if (stage === "demographics") {
      await db.demographic.upsert({
        where: { respondentId: r.id },
        update: { data: json },
        create: { respondentId: r.id, data: json },
      })
      // Sync to Supabase
      fireAndForget(syncDemographics(r.code, answers))

    } else if (stage === "cesdr") {
      const a = answers as Record<number, number>
      let total = 0
      for (const k in a) total += a[k] ?? 0
      const highRisk = (a[18] ?? 0) >= 2
      await db.cesdrAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json, totalScore: total, highRisk },
        create: { respondentId: r.id, answers: json, totalScore: total, highRisk },
      })
      // Sync to Supabase
      fireAndForget(syncCesdrAnswers(r.code, a, total, highRisk))

    } else if (stage === "psqi") {
      await db.psqiAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json },
        create: { respondentId: r.id, answers: json },
      })
      // Sync to Supabase
      fireAndForget(syncPsqiAnswers(r.code, answers, 0))

    } else if (stage === "screentime") {
      await db.screenTimeAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json },
        create: { respondentId: r.id, answers: json },
      })
      // Sync to Supabase
      fireAndForget(syncScreentimeAnswers(r.code, answers))

    } else if (stage === "mos") {
      const a = answers as Record<number, number>
      let total = 0
      for (const k in a) total += a[k] ?? 0
      await db.mosAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json, totalScore: total },
        create: { respondentId: r.id, answers: json, totalScore: total },
      })
      // Sync to Supabase
      fireAndForget(syncMosAnswers(r.code, a, total))

    } else if (stage === "bullying") {
      const a = answers as Record<number, number>
      let total = 0
      for (const k in a) total += a[k] ?? 0
      await db.bullyingAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json, victimScore: total },
        create: { respondentId: r.id, answers: json, victimScore: total },
      })
      // Sync to Supabase
      fireAndForget(syncBullyingAnswers(r.code, a, total))

    } else if (stage === "religiosity") {
      const a = answers as Record<number, number>
      let total = 0
      for (const k in a) total += a[k] ?? 0
      await db.religiosityAnswer.upsert({
        where: { respondentId: r.id },
        update: { answers: json, totalScore: total },
        create: { respondentId: r.id, answers: json, totalScore: total },
      })
      // Sync to Supabase
      fireAndForget(syncReligiosityAnswers(r.code, a, total))
    }
  }

  await db.respondent.update({ where: { id: r.id }, data: { stageIndex } })
  // Sync respondent stage_index to Supabase
  syncRespondentToSupabase(r, { stageIndex })

  return NextResponse.json({ ok: true })
}
