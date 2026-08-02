import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/ai-analytics
// Generates a narrative summary (Bab IV thesis style) using z-ai-web-dev-sdk
export async function POST() {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Gather data
  const list = await db.respondent.findMany({
    where: { status: "completed" },
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

  if (list.length === 0) {
    return NextResponse.json({
      narrative: "Belum ada responden yang menyelesaikan penelitian, sehingga analisis AI belum dapat dihasilkan.",
    })
  }

  // Compute summary stats
  const arr = (sel: (typeof list)[number]) => [
    sel.cesdr?.totalScore ?? null,
    sel.psqi?.totalScore ?? null,
    sel.mos?.totalScore ?? null,
    sel.bullying?.victimScore ?? null,
    sel.religiosity?.totalScore ?? null,
  ]
  void arr

  const scores = {
    cesdr: list.map((r) => r.cesdr?.totalScore ?? 0),
    psqi: list.map((r) => r.psqi?.totalScore ?? 0),
    mos: list.map((r) => r.mos?.totalScore ?? 0),
    bullying: list.map((r) => r.bullying?.victimScore ?? 0),
    religiosity: list.map((r) => r.religiosity?.totalScore ?? 0),
  }

  const sum = (a: number[]) => ({
    n: a.length,
    mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2),
    min: Math.min(...a),
    max: Math.max(...a),
  })

  function corr(a: number[], b: number[]) {
    const n = Math.min(a.length, b.length)
    if (n < 2) return 0
    const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n
    const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n
    let num = 0, da = 0, db = 0
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb)
      da += (a[i] - ma) ** 2
      db += (b[i] - mb) ** 2
    }
    const den = Math.sqrt(da * db)
    return den === 0 ? 0 : +(num / den).toFixed(3)
  }

  // Demographics
  const demo = list.map((r) => (r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}))
  const byGender: Record<string, number> = {}
  const bySchool: Record<string, number> = {}
  const byAge: Record<string, number> = {}
  demo.forEach((d) => {
    byGender[d.gender ?? "?"] = (byGender[d.gender ?? "?"] ?? 0) + 1
    bySchool[d.school ?? "?"] = (bySchool[d.school ?? "?"] ?? 0) + 1
    byAge[String(d.age ?? "?")] = (byAge[String(d.age ?? "?")] ?? 0) + 1
  })

  const highRiskCount = list.filter((r) => r.highRisk).length
  const depressiveCount = list.filter((r) => (r.cesdr?.totalScore ?? 0) >= 16).length

  const payload = {
    totalResponden: list.length,
    highRisk: highRiskCount,
    depressiveGejalaBermakna: depressiveCount,
    demografi: {
      jenisKelamin: byGender,
      sekolah: bySchool,
      usia: byAge,
    },
    statistikDeskriptif: {
      cesdr: sum(scores.cesdr),
      psqi: sum(scores.psqi),
      mos: sum(scores.mos),
      bullying: sum(scores.bullying),
      religiusitas: sum(scores.religiosity),
    },
    korelasi: {
      cesdr_psqi: corr(scores.cesdr, scores.psqi),
      cesdr_mos: corr(scores.cesdr, scores.mos),
      cesdr_bullying: corr(scores.cesdr, scores.bullying),
      cesdr_religiusitas: corr(scores.cesdr, scores.religiosity),
    },
  }

  const systemPrompt =
    "Anda adalah ahli statistik kesehatan dan peneliti kesehatan mental remaja. " +
    "Berdasarkan data hasil penelitian yang diberikan, tuliskan ringkasan naratif analitis dalam Bahasa Indonesia " +
    "formal-akademik yang siap dimasukkan ke Bab IV (Hasil dan Pembahasan) tesis. " +
    "Sertakan: (1) gambaran umum responden, (2) statistik deskriptif tiap instrumen (rerata, min, max), " +
    "(3) interpretasi skor CESD-R (gejala depresi) dan proporsi high-risk, " +
    "(4) korelasi CESD-R dengan PSQI, MOS-SSS, Bullying, dan Religiusitas beserta interpretasi kekuatan dan arah, " +
    "(5) faktor dominan, (6) rekomendasi singkat. Gunakan paragraf dan poin-poin yang rapi."

  const userMessage = `Berikut adalah hasil analisis penelitian biopsikososial depresi remaja SMP:\n\n${JSON.stringify(payload, null, 2)}\n\nTolong hasilkan ringkasan naratif Bab IV.`

  // PERF (audit finding): this endpoint used to call the AI SDK without
  // `stream: true` and wait for the entire Bab IV narrative to finish
  // generating before sending anything back — for a long narrative that
  // can be many seconds with zero feedback on screen ("Generate AI menjadi
  // lambat"). z-ai-web-dev-sdk supports `stream: true` and returns the raw
  // SSE ReadableStream from the upstream API when it does. We forward that
  // stream to the browser as plain text chunks so the narrative can start
  // rendering well under a second, token by token, instead of all at once
  // at the end.
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      thinking: { type: "disabled" },
      stream: true,
    })

    // Non-streaming fallback: if the SDK/provider ignored `stream: true`
    // and returned a parsed JSON completion instead of a ReadableStream.
    if (!(completion instanceof ReadableStream)) {
      const narrative =
        completion?.choices?.[0]?.message?.content ??
        "Tidak dapat menghasilkan ringkasan AI saat ini."
      return NextResponse.json({ narrative, payload })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const upstream = completion.getReader()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = ""
        try {
          while (true) {
            const { done, value } = await upstream.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            // Upstream is OpenAI-style SSE: lines of `data: {...}` separated
            // by blank lines, terminated by `data: [DONE]`.
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? "" // keep last (possibly partial) line
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith("data:")) continue
              const payloadStr = trimmed.slice(5).trim()
              if (payloadStr === "[DONE]") continue
              try {
                const json = JSON.parse(payloadStr)
                const delta: string = json?.choices?.[0]?.delta?.content ?? ""
                if (delta) controller.enqueue(encoder.encode(delta))
              } catch {
                // ignore non-JSON keep-alive lines
              }
            }
          }
        } catch (e) {
          console.error("[ai-analytics] stream error", e)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        // Let the client also read the payload used to build the prompt,
        // for parity with the old JSON response shape.
        "X-Payload": encodeURIComponent(JSON.stringify(payload)),
      },
    })
  } catch (e) {
    console.error("[ai-analytics]", e)
    return NextResponse.json(
      {
        narrative:
          "Ringkasan AI tidak dapat dihasilkan saat ini. Silakan lihat statistik deskriptif di dashboard.",
        payload,
      },
      { status: 200 }
    )
  }
}
