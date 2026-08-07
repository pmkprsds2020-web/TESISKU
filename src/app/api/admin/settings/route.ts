import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// GET /api/admin/settings — retrieve all settings for the current researcher's project
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const settings = await db.setting.findMany({ where: { projectId: admin } })
  const obj: Record<string, unknown> = {}
  for (const s of settings) {
    try { obj[s.key] = JSON.parse(s.value) } catch { obj[s.key] = s.value }
  }
  // Defaults
  const defaults: Record<string, unknown> = {
    targetRespondents: 100,
    researchTitle: "",
    researcherName: "",
    researcherEmail: "",
    bkContactName: "",
    bkContactPhone: "",
    schools: [],
    ethicsApprovalNumber: "",
    dataRetentionDays: 365,
  }
  return NextResponse.json({ settings: { ...defaults, ...obj } })
}

// PUT /api/admin/settings — update settings (merges), scoped to the current project
export async function PUT(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  for (const [key, value] of Object.entries(body)) {
    await db.setting.upsert({
      where: { projectId_key: { projectId: admin, key } },
      update: { value: JSON.stringify(value) },
      create: { projectId: admin, key, value: JSON.stringify(value) },
    })
  }

  await db.auditLog.create({
    data: { projectId: admin, action: "admin_update_settings", detail: `Updated keys: ${Object.keys(body).join(", ")}` },
  })

  return NextResponse.json({ ok: true })
}
