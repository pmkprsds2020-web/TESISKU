// Seed script: create research codes + default admin user + demo data
// Run: bun run scripts/seed.ts
import { db } from "../src/lib/db"
import { createHash } from "crypto"

function hashPassword(pw: string) {
  return createHash("sha256").update(pw + "::teenmind").digest("hex")
}

async function main() {
  const existing = await db.adminUser.findUnique({ where: { username: "admin" } })
  if (!existing) {
    await db.adminUser.create({
      data: { username: "admin", password: hashPassword("teenmind2025"), name: "Peneliti" },
    })
    console.log("✓ Admin user created (admin / teenmind2025)")
  } else {
    console.log("• Admin user already exists")
  }

  const schools = ["SMP Harapan", "SMP Negeri 1", "SMP Tunas"]
  let created = 0
  for (let s = 0; s < schools.length; s++) {
    for (let n = 1; n <= 10; n++) {
      const code = `SMP${String(s + 1).padStart(3, "0")}${String(n).padStart(3, "0")}`
      await db.researchCode.upsert({
        where: { code },
        update: {},
        create: { code, school: schools[s], classGrade: `Kelas ${7 + (n % 3)}` },
      })
      created++
    }
  }
  console.log(`✓ ${created} research codes ensured`)

  const completedCount = await db.respondent.count({ where: { status: "completed" } })
  if (completedCount === 0) {
    console.log("• No completed respondents yet — seeding demo data...")
    await seedDemoData()
  }

  console.log("\n🎉 Seed complete!")
  console.log("   Responden login contoh: SMP001001")
  console.log("   Admin login: admin / teenmind2025")
}

async function seedDemoData() {
  const schools = ["SMP Harapan", "SMP Negeri 1", "SMP Tunas"]
  const genders = ["laki-laki", "perempuan"]
  const codes = await db.researchCode.findMany({ take: 24 })
  let i = 0
  for (const rc of codes) {
    i++
    const r = await db.respondent.create({
      data: {
        code: rc.code,
        school: rc.school,
        status: "completed",
        currentStage: "complete",
        consentGiven: true,
        highRisk: i % 7 === 0,
        startedAt: new Date(Date.now() - (24 - i) * 3600_000),
        completedAt: new Date(Date.now() - (24 - i) * 3600_000 + 600_000),
      },
    })
    await db.researchCode.update({ where: { code: rc.code }, data: { used: true } })

    const demo = {
      initial: String.fromCharCode(65 + (i % 26)),
      age: 12 + (i % 5),
      gender: genders[i % 2],
      school: rc.school ?? schools[i % 3],
      classGrade: String(7 + (i % 3)),
      residence: ["kota", "desa", "pinggiran"][i % 3],
      parentIncome: ["1-3jt", "3-5jt", "5-10jt", "<1jt", ">10jt"][i % 5],
      fatherEducation: ["sma", "sarjana", "smp", "diploma"][i % 4],
      motherEducation: ["sma", "sarjana", "smp", "diploma"][i % 4],
      familyComposition: ["ortu", "ortu-satu", "kakek-nenek"][i % 3],
      chronicIllness: i % 9 === 0 ? "asma" : "tidak",
      mentalHistory: i % 8 === 0 ? "keluarga" : "tidak",
    }
    await db.demographic.create({ data: { respondentId: r.id, data: JSON.stringify(demo) } })

    const cesdr: Record<number, number> = {}
    let cesdrTotal = 0
    for (let q = 1; q <= 20; q++) {
      const v = Math.floor(Math.random() * 4)
      cesdr[q] = v
      cesdrTotal += v
    }
    if (i % 7 === 0) {
      cesdr[18] = 2 + Math.floor(Math.random() * 2)
    }
    cesdrTotal = Object.values(cesdr).reduce((a, b) => a + b, 0)
    await db.cesdrAnswer.create({
      data: {
        respondentId: r.id,
        answers: JSON.stringify(cesdr),
        totalScore: cesdrTotal,
        highRisk: (cesdr[18] ?? 0) >= 2,
      },
    })

    const psqi = {
      bedtime: "21:30",
      waketime: "05:00",
      sleepLatency: 10 + (i % 30),
      actualSleep: 6 + (i % 4),
      sleepQuality: i % 4,
      cantSleep30: i % 4,
      wakeNight: i % 3,
      cantBreathe: i % 4,
      daySleepiness: i % 4,
      enthusiasm: i % 4,
    }
    await db.psqiAnswer.create({ data: { respondentId: r.id, answers: JSON.stringify(psqi), totalScore: 8 + (i % 8) } })

    const st: Record<string, number> = {}
    ;["hp", "laptop", "tablet", "tiktok", "instagram", "youtube", "whatsapp", "beforeSleep", "feelAfter"].forEach((k, idx) => {
      st[k] = (i + idx) % 5
    })
    await db.screenTimeAnswer.create({ data: { respondentId: r.id, answers: JSON.stringify(st) } })

    const mos: Record<number, number> = {}
    let mosTotal = 0
    for (let q = 1; q <= 8; q++) {
      mos[q] = 1 + ((i + q) % 5)
      mosTotal += mos[q]
    }
    await db.mosAnswer.create({ data: { respondentId: r.id, answers: JSON.stringify(mos), totalScore: mosTotal } })

    const bl: Record<number, number> = {}
    let blTotal = 0
    for (let q = 1; q <= 8; q++) {
      bl[q] = (i + q) % 4
      blTotal += bl[q]
    }
    await db.bullyingAnswer.create({ data: { respondentId: r.id, answers: JSON.stringify(bl), victimScore: blTotal } })

    const rel: Record<number, number> = {}
    let relTotal = 0
    for (let q = 1; q <= 8; q++) {
      rel[q] = 1 + ((i + q) % 5)
      relTotal += rel[q]
    }
    await db.religiosityAnswer.create({ data: { respondentId: r.id, answers: JSON.stringify(rel), totalScore: relTotal } })
  }
  console.log(`✓ Seeded ${codes.length} demo respondents`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
