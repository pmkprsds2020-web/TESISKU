import { describe, it, expect } from "vitest"
import {
  scoreCesdr,
  scorePsqi,
  scoreMos,
  scoreBullying,
  scoreClimateSchool,
  scoreReligiosity,
} from "../scoring"

describe("scoreCesdr", () => {
  it("sums all 20 items", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = 1
    const r = scoreCesdr(answers)
    expect(r.total).toBe(20)
  })

  it("flags depressive when total >= 16", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = i <= 16 ? 1 : 0
    const r = scoreCesdr(answers)
    expect(r.total).toBe(16)
    expect(r.depressive).toBe(true)
  })

  it("flags high risk when item 18 >= threshold (2)", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = 0
    answers[18] = 2
    const r = scoreCesdr(answers)
    expect(r.highRisk).toBe(true)
  })

  it("does not flag high risk below threshold", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = 0
    answers[18] = 1
    const r = scoreCesdr(answers)
    expect(r.highRisk).toBe(false)
  })
})

describe("scorePsqi", () => {
  it("computes poor sleep quality when global score > 5", () => {
    const r = scorePsqi({
      sleepQuality: 3,
      sleepLatency: 90, // c2 = 3
      actualSleep: 3, // c3 = 3
      bedtime: "23:00",
      waketime: "05:00", // low efficiency -> c4 likely 2-3
      sleepDisturbance: 3,
      daySleepiness: 3,
    })
    expect(r.total).toBeGreaterThan(5)
    expect(r.poorSleepQuality).toBe(true)
  })

  it("computes good sleep quality for ideal answers", () => {
    const r = scorePsqi({
      sleepQuality: 0,
      sleepLatency: 5,
      actualSleep: 8,
      bedtime: "22:00",
      waketime: "06:00",
      sleepDisturbance: 0,
      daySleepiness: 0,
    })
    expect(r.poorSleepQuality).toBe(false)
  })

  it("documents C6 (sleep medication) as an unmeasured limitation", () => {
    const r = scorePsqi({})
    expect(r.components.c6_sleepMedication).toBe(0)
    expect(r.limitations.some((l) => l.includes("C6"))).toBe(true)
  })
})

describe("scoreMos", () => {
  it("sums items 1-10", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 10; i++) answers[i] = 5
    expect(scoreMos(answers)).toBe(50)
  })

  it("treats missing items as 0", () => {
    expect(scoreMos({ 1: 5 })).toBe(5)
  })
})

describe("scoreBullying (GBS, item 1-4 only)", () => {
  it("sums only items 1-4, ignoring Climate School items 5-12", () => {
    const answers: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 4, 6: 4, 12: 4 }
    expect(scoreBullying(answers)).toBe(4)
  })

  it("returns 0 when no bullying reported", () => {
    expect(scoreBullying({ 1: 0, 2: 0, 3: 0, 4: 0 })).toBe(0)
  })
})

describe("scoreClimateSchool", () => {
  // Positive items 5,6,7,8,11,12: 1 = Sangat Setuju (good) ... 4 = Sangat Tidak Setuju (bad)
  // Negative items 9,10 are reverse-scored: 1 = Sangat Setuju (bad) becomes 4 after reversal.
  it("gives a low (supportive) total when the respondent agrees with positive items and disagrees with negative items", () => {
    const answers: Record<number, number> = {
      5: 1, 6: 1, 7: 1, 8: 1, // strongly agree with positive statements -> raw 1 each
      9: 4, 10: 4, // strongly disagree with negative statements -> raw 4, reversed -> 1
      11: 1, 12: 1,
    }
    const r = scoreClimateSchool(answers)
    // 6 positive items * 1 + 2 reverse-scored items * (5-4=1) = 8 (minimum possible)
    expect(r.total).toBe(8)
    expect(r.category).toBe("Lingkungan sekolah supportif")
    expect(r.recommendation).toBeNull()
  })

  it("gives a high (less supportive) total when the respondent disagrees with positive items and agrees with negative items", () => {
    const answers: Record<number, number> = {
      5: 4, 6: 4, 7: 4, 8: 4, // strongly disagree with positive statements -> raw 4 each
      9: 1, 10: 1, // strongly agree with negative statements -> raw 1, reversed -> 4
      11: 4, 12: 4,
    }
    const r = scoreClimateSchool(answers)
    // 6 positive items * 4 + 2 reverse-scored items * (5-1=4) = 32 (maximum possible)
    expect(r.total).toBe(32)
    expect(r.category).toBe("Lingkungan sekolah kurang supportif")
    expect(r.recommendation).not.toBeNull()
  })

  it("reverse-scores negative items correctly at the midpoint", () => {
    const answers: Record<number, number> = {
      5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2,
    }
    // positive items: 2 each (6 items = 12); negative items reversed: 5-2=3 each (2 items = 6)
    const r = scoreClimateSchool(answers)
    expect(r.total).toBe(18)
  })

  it("does not include GBS items 1-4 in the total", () => {
    const withGbs = scoreClimateSchool({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 1, 6: 1, 7: 1, 8: 1, 9: 4, 10: 4, 11: 1, 12: 1 })
    const withoutGbs = scoreClimateSchool({ 5: 1, 6: 1, 7: 1, 8: 1, 9: 4, 10: 4, 11: 1, 12: 1 })
    expect(withGbs.total).toBe(withoutGbs.total)
  })
})

describe("scoreReligiosity", () => {
  it("sums items 1-8", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 8; i++) answers[i] = 4
    expect(scoreReligiosity(answers)).toBe(32)
  })
})
