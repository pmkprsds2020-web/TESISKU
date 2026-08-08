import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { spawn } from "child_process"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { randomUUID } from "crypto"
import { scorePsqi, scoreClimateSchool, scoreScreenTime } from "@/lib/scoring"

// GET /api/admin/export-sav — generates real SPSS .sav file via Python pyreadstat
//
// NOTE (perbaikan besar): versi lama route ini punya beberapa bug yang
// membuat data hilang diam-diam dari file .sav:
//  - MOS-SSS hanya diekspor item 1-8 (dari 10 item) — item 9-10 hilang.
//  - "Bullying" (field DB yang sebenarnya berisi GBS 1-4 + Climate School
//    5-12) hanya diekspor item 1-8 — item 9-12 (termasuk 2 item Climate
//    School bermuatan negatif) hilang seluruhnya, dan GBS/Climate tidak
//    dipisah/dilabeli dengan benar.
//  - Field Screen Time diekspor dengan nama yang SAMA SEKALI tidak cocok
//    dengan field asli kuesioner (sisa draft lama) — kolom-kolom itu selalu
//    kosong di file .sav manapun yang pernah dihasilkan.
//  - PSQI hanya 5 kolom lama, tidak menyertakan 9 item baru (5a-5j, obat
//    tidur, item C7 kedua) yang ditambahkan saat kuesioner diperluas.
// Semua diperbaiki di bawah: GBS & Climate School dipisah dengan skor yang
// benar (memakai scoreClimateSchool() yang sama seperti laporan), Screen
// Time memakai field asli, dan PSQI diekspor SELURUH item secara dinamis
// (generic spread) supaya penambahan item PSQI di masa depan tidak lagi
// butuh perbaikan manual di sini.
export async function GET() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Gather all respondent data (same as CSV export)
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

  const respondents = list.map((r) => {
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
        gbs: r.bullying?.victimScore ?? null, // GBS (item 1-4) saja
        climate: climate?.total ?? null, // Climate School (item 5-12, reverse-scored), lihat scoreClimateSchool()
        religiosity: r.religiosity?.totalScore ?? null,
        screentime: screenTime?.total ?? null, // deskriptif, bukan skala baku — lihat scoreScreenTime()
      },
    }
    // Flatten CESD-R items
    for (let i = 1; i <= 20; i++) row[`cesdr_${i}`] = cesdr[i] ?? ""
    // PSQI — seluruh item diekspor secara dinamis (bukan daftar tetap), supaya
    // penambahan/pengubahan item PSQI di masa depan tidak butuh perbaikan manual.
    for (const [k, v] of Object.entries(psqi)) row[`psqi_${k}`] = v ?? ""
    if (psqiComponents) {
      row.psqi_c1_subjectiveQuality = psqiComponents.c1_subjectiveQuality
      row.psqi_c2_sleepLatency = psqiComponents.c2_sleepLatency
      row.psqi_c3_sleepDuration = psqiComponents.c3_sleepDuration
      row.psqi_c4_sleepEfficiency = psqiComponents.c4_sleepEfficiency
      row.psqi_c5_sleepDisturbance = psqiComponents.c5_sleepDisturbance
      row.psqi_c6_sleepMedication = psqiComponents.c6_sleepMedication
      row.psqi_c7_daytimeDysfunction = psqiComponents.c7_daytimeDysfunction
    }
    // Screen time — field asli kuesioner (weekdayScreen, weekendScreen,
    // socialCompare, cyberbullying, sleepDelay); "platforms" multi-select
    // digabung jadi string dipisah titik-koma.
    for (const k of ["weekdayScreen", "weekendScreen", "socialCompare", "cyberbullying", "sleepDelay"]) {
      row[`st_${k}`] = st[k] ?? ""
    }
    row.st_platforms = Array.isArray(st.platforms) ? st.platforms.join(";") : ""
    // MOS-SSS — 10 item (bukan 8)
    for (let i = 1; i <= 10; i++) row[`mos_${i}`] = mos[i] ?? ""
    // GBS (Bullying) — item 1-4 dari field "bullying"
    for (let i = 1; i <= 4; i++) row[`gbs_${i}`] = bl[i] ?? ""
    // Climate School — item 5-12 dari field "bullying", dilabeli ulang 1-8
    // supaya jelas ini instrumen terpisah dari GBS.
    for (let i = 1; i <= 8; i++) row[`climate_${i}`] = bl[i + 4] ?? ""
    // Religiosity — 8 item
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
