import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { scorePsqi, scoreClimateSchool, scoreScreenTime } from "@/lib/scoring"

// GET /api/admin/export?format=csv|json
//
// NOTE (perbaikan): PSQI dulu hanya mengekspor 5 kolom tetap (termasuk
// melewatkan "daySleepiness" yang sudah lama ada), sehingga 9 item baru
// (5a-5j, obat tidur, item C7 kedua) tidak pernah ikut ekspor. Sekarang
// seluruh item PSQI diekspor secara dinamis (generic spread), sama seperti
// MOS/Bullying yang sudah generik sejak awal. "Bullying" juga dipisah jadi
// gbs_* (item 1-4) dan climate_* (item 5-12, dilabeli ulang 1-8) supaya
// jelas ini dua instrumen berbeda — lihat penjelasan yang sama di
// export-sav/route.ts.
export async function GET(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "csv"

  const list = await db.respondent.findMany({
    where: { projectId: admin },
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
    const st = r.screentime ? (JSON.parse(r.screentime.answers) as Record<string, number | number[]>) : {}
    const mos = r.mos ? (JSON.parse(r.mos.answers) as Record<string, number>) : {}
    const bl = r.bullying ? (JSON.parse(r.bullying.answers) as Record<string, number>) : {}
    const rel = r.religiosity ? (JSON.parse(r.religiosity.answers) as Record<string, number>) : {}

    const psqiComponents = r.psqi ? scorePsqi(psqi).components : null
    const climate = r.bullying ? scoreClimateSchool(bl) : null
    const screenTime = r.screentime ? scoreScreenTime(st) : null

    const gbsEntries: Record<string, number | string> = {}
    const climateEntries: Record<string, number | string> = {}
    for (const [k, v] of Object.entries(bl)) {
      const n = Number(k)
      if (n >= 1 && n <= 4) gbsEntries[`gbs_${n}`] = v
      else if (n >= 5 && n <= 12) climateEntries[`climate_${n - 4}`] = v
    }

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
      // PSQI — seluruh item (dinamis, bukan daftar tetap) + breakdown komponen C1-C7
      ...Object.fromEntries(Object.entries(psqi).map(([k, v]) => [`psqi_${k}`, v ?? ""])),
      ...(psqiComponents ? {
        psqi_c1_subjectiveQuality: psqiComponents.c1_subjectiveQuality,
        psqi_c2_sleepLatency: psqiComponents.c2_sleepLatency,
        psqi_c3_sleepDuration: psqiComponents.c3_sleepDuration,
        psqi_c4_sleepEfficiency: psqiComponents.c4_sleepEfficiency,
        psqi_c5_sleepDisturbance: psqiComponents.c5_sleepDisturbance,
        psqi_c6_sleepMedication: psqiComponents.c6_sleepMedication,
        psqi_c7_daytimeDysfunction: psqiComponents.c7_daytimeDysfunction,
      } : {}),
      psqi_total: r.psqi?.totalScore ?? "",
      // Screen time (deskriptif, bukan skala baku)
      ...Object.fromEntries(Object.entries(st).map(([k, v]) => [`st_${k}`, Array.isArray(v) ? v.join(";") : v])),
      screentime_total: screenTime?.total ?? "",
      // MOS-SSS (10 item)
      ...Object.fromEntries(Object.entries(mos).map(([k, v]) => [`mos_${k}`, v])),
      mos_total: r.mos?.totalScore ?? "",
      // GBS (Bullying, item 1-4)
      ...gbsEntries,
      gbs_total: r.bullying?.victimScore ?? "",
      // Climate School (item 5-12, dilabeli ulang 1-8)
      ...climateEntries,
      climate_total: climate?.total ?? "",
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
