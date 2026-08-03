import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// GET /api/admin/export?format=csv|json
export async function GET(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "csv"

  const list = await db.respondent.findMany({
    orderBy: { startedAt: "asc" },
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

  const rows = list.map((r) => {
    const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
    const cesdr = r.cesdr ? (JSON.parse(r.cesdr.answers) as Record<string, number>) : {}
    const psqi = r.psqi ? (JSON.parse(r.psqi.answers) as Record<string, string | number>) : {}
    const st = r.screentime ? (JSON.parse(r.screentime.answers) as Record<string, number>) : {}
    const mos = r.mos ? (JSON.parse(r.mos.answers) as Record<string, number>) : {}
    const bl = r.bullying ? (JSON.parse(r.bullying.answers) as Record<string, number>) : {}
    const rel = r.religiosity ? (JSON.parse(r.religiosity.answers) as Record<string, number>) : {}

    return {
      code: r.code,
      school: r.school ?? "",
      status: r.status,
      highRisk: r.highRisk ? 1 : 0,
      consentGiven: r.consentGiven ? 1 : 0,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? "",
      // Demographic
      initial: demo.initial ?? "",
      age: demo.age ?? "",
      gender: demo.gender ?? "",
      classGrade: demo.classGrade ?? "",
      residence: demo.residence ?? "",
      parentIncome: demo.parentIncome ?? "",
      fatherEducation: demo.fatherEducation ?? "",
      motherEducation: demo.motherEducation ?? "",
      familyComposition: demo.familyComposition ?? "",
      chronicIllness: demo.chronicIllness ?? "",
      mentalHistory: demo.mentalHistory ?? "",
      // CESD-R items
      ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`cesdr_${i + 1}`, cesdr[i + 1] ?? ""])),
      cesdr_total: r.cesdr?.totalScore ?? "",
      // PSQI
      psqi_bedtime: psqi.bedtime ?? "",
      psqi_waketime: psqi.waketime ?? "",
      psqi_sleepLatency: psqi.sleepLatency ?? "",
      psqi_actualSleep: psqi.actualSleep ?? "",
      psqi_sleepQuality: psqi.sleepQuality ?? "",
      psqi_total: r.psqi?.totalScore ?? "",
      // Screen time
      ...Object.fromEntries(Object.entries(st).map(([k, v]) => [`st_${k}`, v])),
      // MOS
      ...Object.fromEntries(Object.entries(mos).map(([k, v]) => [`mos_${k}`, v])),
      mos_total: r.mos?.totalScore ?? "",
      // Bullying
      ...Object.fromEntries(Object.entries(bl).map(([k, v]) => [`bl_${k}`, v])),
      bullying_total: r.bullying?.victimScore ?? "",
      // Religiosity
      ...Object.fromEntries(Object.entries(rel).map(([k, v]) => [`rel_${k}`, v])),
      religiosity_total: r.religiosity?.totalScore ?? "",
    }
  })

  if (format === "json") {
    return NextResponse.json(rows, {
      headers: { "Content-Disposition": `attachment; filename="teenmind_export.json"` },
    })
  }

  // CSV
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const escape = (v: unknown) => {
    const s = String(v ?? "")
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(",")),
  ].join("\n")

  // SPSS-like .sav is not natively generatable; we provide a "sav" hint as a tab-separated file
  // with a .sav extension and a note. Real .sav needs pyreadstat. We provide CSV fallback.
  if (format === "sav") {
    const tsv = [
      headers.join("\t"),
      ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join("\t")),
    ].join("\n")
    return new NextResponse(tsv, {
      headers: {
        "Content-Type": "text/tab-separated-values",
        "Content-Disposition": `attachment; filename="teenmind_export.sav"`,
      },
    })
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="teenmind_export.csv"`,
    },
  })
}
