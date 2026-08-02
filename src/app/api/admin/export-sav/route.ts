import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { spawn } from "child_process"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { randomUUID } from "crypto"

// GET /api/admin/export-sav — generates real SPSS .sav file via Python pyreadstat
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Gather all respondent data (same as CSV export)
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

  const respondents = list.map((r) => {
    const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
    const cesdr = r.cesdr ? (JSON.parse(r.cesdr.answers) as Record<string, number>) : {}
    const psqi = r.psqi ? (JSON.parse(r.psqi.answers) as Record<string, string | number>) : {}
    const st = r.screentime ? (JSON.parse(r.screentime.answers) as Record<string, number>) : {}
    const mos = r.mos ? (JSON.parse(r.mos.answers) as Record<string, number>) : {}
    const bl = r.bullying ? (JSON.parse(r.bullying.answers) as Record<string, number>) : {}
    const rel = r.religiosity ? (JSON.parse(r.religiosity.answers) as Record<string, number>) : {}

    const row: Record<string, unknown> = {
      code: r.code,
      school: r.school ?? "",
      status: r.status,
      highRisk: r.highRisk,
      consentGiven: r.consentGiven,
      demographic: demo,
      scores: {
        cesdr: r.cesdr?.totalScore ?? null,
        psqi: r.psqi?.totalScore ?? null,
        mos: r.mos?.totalScore ?? null,
        bullying: r.bullying?.victimScore ?? null,
        religiosity: r.religiosity?.totalScore ?? null,
      },
    }
    // Flatten CESD-R items
    for (let i = 1; i <= 20; i++) row[`cesdr_${i}`] = cesdr[i] ?? ""
    // PSQI
    row.psqi_bedtime = psqi.bedtime ?? ""
    row.psqi_waketime = psqi.waketime ?? ""
    row.psqi_sleepLatency = psqi.sleepLatency ?? ""
    row.psqi_actualSleep = psqi.actualSleep ?? ""
    row.psqi_sleepQuality = psqi.sleepQuality ?? ""
    // Screen time
    for (const k of ["hp", "laptop", "tablet", "tiktok", "instagram", "youtube", "whatsapp", "beforeSleep", "feelAfter"]) {
      row[`st_${k}`] = st[k] ?? ""
    }
    // MOS
    for (let i = 1; i <= 8; i++) row[`mos_${i}`] = mos[i] ?? ""
    // Bullying
    for (let i = 1; i <= 8; i++) row[`bl_${i}`] = bl[i] ?? ""
    // Religiosity
    for (let i = 1; i <= 8; i++) row[`rel_${i}`] = rel[i] ?? ""
    return row
  })

  const payload = JSON.stringify({ respondents })
  const scriptPath = join(process.cwd(), "scripts", "export_sav.py")
  const tmpFile = join(tmpdir(), `teenmind_${randomUUID()}.sav`)

  return new Promise<Response>((resolve) => {
    const python = spawn("python3", [scriptPath], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    })

    let stderr = ""
    let stdout: Buffer[] = []

    python.stdin.write(payload)
    python.stdin.end()

    python.stdout.on("data", (data: Buffer) => {
      stdout.push(data)
    })

    python.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
    })

    python.on("close", (code: number) => {
      if (code !== 0) {
        console.error("[export-sav] Python failed:", stderr)
        // Fallback: return error
        resolve(
          new NextResponse(
            JSON.stringify({ error: "SPSS export failed", detail: stderr.slice(0, 500) }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          )
        )
        return
      }

      const buffer = Buffer.concat(stdout)
      void writeFile(tmpFile, buffer).then(() => {
        void unlink(tmpFile).catch(() => {})
      })

      resolve(
        new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/x-spss-sav",
            "Content-Disposition": `attachment; filename="teenmind_export.sav"`,
            "Content-Length": String(buffer.length),
          },
        })
      )
    })
  }) as Promise<Response>
}
