import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// GET /api/admin/codes — list all research codes with usage status
export async function GET(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get("filter") // "used" | "unused" | null
  const q = searchParams.get("q") // search by code or school

  const where: Record<string, unknown> = { projectId: admin }
  if (filter === "used") where.used = true
  if (filter === "unused") where.used = false
  if (q) {
    where.OR = [
      { code: { contains: q.toUpperCase() } },
      { school: { contains: q } },
    ]
  }

  const codes = await db.researchCode.findMany({
    where,
    orderBy: { code: "asc" },
    take: 500,
  })

  // Attach respondent status
  const respondents = await db.respondent.findMany({
    where: { projectId: admin, code: { in: codes.map((c) => c.code) } },
    select: { code: true, status: true, highRisk: true, completedAt: true },
  })
  const respMap = new Map(respondents.map((r) => [r.code, r]))

  return NextResponse.json({
    codes: codes.map((c) => ({
      code: c.code,
      school: c.school,
      classGrade: c.classGrade,
      used: c.used,
      createdAt: c.createdAt,
      respondent: respMap.get(c.code) ?? null,
    })),
    total: codes.length,
  })
}

// POST /api/admin/codes — create single, batch, or import codes
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()

  // Import mode: array of { code, school?, classGrade? }
  if (Array.isArray(body.importCodes)) {
    const created: string[] = []
    for (const item of body.importCodes) {
      const code = String(item.code ?? "").trim().toUpperCase()
      if (!code) continue
      const existing = await db.researchCode.findUnique({
        where: { projectId_code: { projectId: admin, code } },
      })
      if (existing) continue
      await db.researchCode.create({
        data: { projectId: admin, code, school: item.school, classGrade: item.classGrade },
      })
      created.push(code)
    }
    await db.auditLog.create({
      data: { projectId: admin, action: "admin_import_codes", detail: `Imported ${created.length} codes` },
    })
    return NextResponse.json({ created, count: created.length })
  }

  // Batch create mode
  const { prefix, school, classGrade, count, startFrom } = body
  const pf = String(prefix ?? "SMP").toUpperCase()
  const n = Math.min(Math.max(Number(count) ?? 1, 1), 200)
  const start = Math.max(Number(startFrom) ?? 1, 1)

  const created: string[] = []
  for (let i = 0; i < n; i++) {
    const seq = String(start + i).padStart(3, "0")
    const code = `${pf}${seq}`
    await db.researchCode.upsert({
      where: { projectId_code: { projectId: admin, code } },
      update: { school, classGrade },
      create: { projectId: admin, code, school, classGrade },
    })
    created.push(code)
  }

  await db.auditLog.create({
    data: {
      projectId: admin,
      action: "admin_create_codes",
      detail: `Created ${created.length} codes: ${created[0]}..${created[created.length - 1]}`,
    },
  })

  return NextResponse.json({ created, count: created.length })
}

// DELETE /api/admin/codes?code=SMP001001 — delete a code (only if unused)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })

  const existing = await db.respondent.findUnique({
    where: { projectId_code: { projectId: admin, code } },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Kode sudah digunakan oleh responden dan tidak dapat dihapus." },
      { status: 409 }
    )
  }

  await db.researchCode.delete({ where: { projectId_code: { projectId: admin, code } } })
  return NextResponse.json({ ok: true })
}
