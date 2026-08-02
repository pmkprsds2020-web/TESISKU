import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// GET /api/codes — list research codes (for admin to distribute)
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const codes = await db.researchCode.findMany({
    orderBy: { code: "asc" },
    take: 1000,
  })
  return NextResponse.json({ codes })
}

// POST /api/codes — create a new code or batch
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { code, school, classGrade, count } = await req.json()
  const created: string[] = []
  if (count && count > 1) {
    // Generate batch: prefix + sequential
    const prefix = String(code ?? "SMP").toUpperCase()
    for (let i = 1; i <= count; i++) {
      const c = `${prefix}${String(i).padStart(3, "0")}`
      await db.researchCode.upsert({
        where: { code: c },
        update: {},
        create: { code: c, school, classGrade },
      })
      created.push(c)
    }
  } else {
    const c = String(code).toUpperCase()
    await db.researchCode.upsert({
      where: { code: c },
      update: {},
      create: { code: c, school, classGrade },
    })
    created.push(c)
  }
  return NextResponse.json({ created })
}
