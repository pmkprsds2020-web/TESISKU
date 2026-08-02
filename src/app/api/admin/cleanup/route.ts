import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// GET /api/admin/cleanup — preview what would be deleted based on dataRetentionDays setting
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 1 })

  // Get retention days from settings
  let retentionDays = 365
  const setting = await db.setting.findUnique({ where: { key: "dataRetentionDays" } })
  if (setting) {
    try { retentionDays = JSON.parse(setting.value) as number } catch { /* keep default */ }
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 3600_000)

  // Count what would be deleted
  const oldRespondents = await db.respondent.findMany({
    where: {
      AND: [
        { status: "completed" },
        { completedAt: { lt: cutoff } },
      ],
    },
    select: { id: true, code: true, completedAt: true },
  })

  const oldCodes = await db.researchCode.findMany({
    where: {
      used: false,
      createdAt: { lt: cutoff },
    },
    select: { code: true, createdAt: true },
  })

  return NextResponse.json({
    retentionDays,
    cutoffDate: cutoff,
    wouldDelete: {
      respondents: oldRespondents.length,
      codes: oldCodes.length,
      respondentCodes: oldRespondents.map(r => ({ code: r.code, completedAt: r.completedAt })),
    },
  })
}

// POST /api/admin/cleanup — actually delete old data
export async function POST() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let retentionDays = 365
  const setting = await db.setting.findUnique({ where: { key: "dataRetentionDays" } })
  if (setting) {
    try { retentionDays = JSON.parse(setting.value) as number } catch { /* keep default */ }
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 3600_000)

  // Delete old completed respondents (cascade will delete related answers)
  const deletedRespondents = await db.respondent.deleteMany({
    where: {
      AND: [
        { status: "completed" },
        { completedAt: { lt: cutoff } },
      ],
    },
  })

  // Delete old unused codes
  const deletedCodes = await db.researchCode.deleteMany({
    where: {
      used: false,
      createdAt: { lt: cutoff },
    },
  })

  await db.auditLog.create({
    data: {
      action: "admin_cleanup",
      detail: `Deleted ${deletedRespondents.count} respondents + ${deletedCodes.count} codes older than ${retentionDays} days`,
    },
  })

  return NextResponse.json({
    ok: true,
    deleted: {
      respondents: deletedRespondents.count,
      codes: deletedCodes.count,
    },
    retentionDays,
    cutoffDate: cutoff,
  })
}
