import { describe, it, expect } from "vitest"
import {
  scoreCesdr,
  scorePsqi,
  scoreMos,
  scoreBullying,
  scoreClimateSchool,
  scoreReligiosity,
  scoreScreenTime,
  climateScoreFromBullyingRelation,
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
  describe("skema lama (adaptasi 7-item, tanpa sub-item 5a-5j)", () => {
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

    it("documents C6 (sleep medication) as an unmeasured limitation when absent", () => {
      const r = scorePsqi({})
      expect(r.components.c6_sleepMedication).toBe(0)
      expect(r.limitations.some((l) => l.includes("C6"))).toBe(true)
    })

    it("falls back to the single 'sleepDisturbance' item for C5 and documents the limitation", () => {
      const r = scorePsqi({ sleepDisturbance: 2 })
      expect(r.components.c5_sleepDisturbance).toBe(2)
      expect(r.limitations.some((l) => l.includes("C5"))).toBe(true)
    })

    it("falls back to a single item for C7 when 'daytimeEnthusiasm' is absent", () => {
      const r = scorePsqi({ daySleepiness: 2 })
      expect(r.components.c7_daytimeDysfunction).toBe(2)
      expect(r.limitations.some((l) => l.includes("C7"))).toBe(true)
    })

    it("falls back to latency-minutes only for C2 when item 5a is absent", () => {
      const r = scorePsqi({ sleepLatency: 45 }) // 45 min -> latency score 2
      expect(r.components.c2_sleepLatency).toBe(2)
      expect(r.limitations.some((l) => l.includes("C2"))).toBe(true)
    })
  })

  describe("skema baru (mendekati 19-item resmi, dengan sub-item 5a-5j)", () => {
    const fullGoodAnswers = {
      sleepQuality: 0,
      sleepLatency: 5,
      actualSleep: 8,
      bedtime: "22:00",
      waketime: "06:00",
      dist5a: 0, dist5b: 0, dist5c: 0, dist5d: 0, dist5e: 0,
      dist5f: 0, dist5g: 0, dist5h: 0, dist5i: 0, dist5j: 0,
      sleepMedication: 0,
      daySleepiness: 0,
      daytimeEnthusiasm: 0,
    }

    it("computes C2 from latency-minutes + item 5a combined, no limitation logged", () => {
      const r = scorePsqi({ ...fullGoodAnswers, sleepLatency: 20, dist5a: 3 }) // latency score 1 + item5a 3 = 4 -> mapped to 2
      expect(r.components.c2_sleepLatency).toBe(2)
      expect(r.limitations.some((l) => l.includes("C2"))).toBe(false)
    })

    it("computes C5 from the sum of 9 sub-items (5b-5j), no limitation logged", () => {
      const r = scorePsqi({ ...fullGoodAnswers, dist5b: 3, dist5c: 3, dist5d: 3, dist5e: 3, dist5f: 3, dist5g: 3, dist5h: 3, dist5i: 3, dist5j: 3 }) // sum = 27 -> mapped to 3
      expect(r.components.c5_sleepDisturbance).toBe(3)
      expect(r.limitations.some((l) => l.includes("C5"))).toBe(false)
    })

    it("computes C6 directly from 'sleepMedication', no limitation logged", () => {
      const r = scorePsqi({ ...fullGoodAnswers, sleepMedication: 3 })
      expect(r.components.c6_sleepMedication).toBe(3)
      expect(r.limitations.some((l) => l.includes("C6"))).toBe(false)
    })

    it("computes C7 from the sum of 2 sub-items, no limitation logged", () => {
      const r = scorePsqi({ ...fullGoodAnswers, daySleepiness: 3, daytimeEnthusiasm: 3 }) // sum 6 -> mapped to 3
      expect(r.components.c7_daytimeDysfunction).toBe(3)
      expect(r.limitations.some((l) => l.includes("C7"))).toBe(false)
    })

    it("computes a minimal total (0) for an all-good/no-symptom response", () => {
      const r = scorePsqi(fullGoodAnswers)
      expect(r.total).toBe(0)
      expect(r.poorSleepQuality).toBe(false)
    })

    it("computes the maximal total (21) for an all-worst response", () => {
      const worst = {
        sleepQuality: 3,
        sleepLatency: 90, // latency score 3
        actualSleep: 2, // c3 = 3
        bedtime: "22:00",
        waketime: "06:00", // 8h in bed vs 2h slept -> efficiency 25% -> c4 = 3
        dist5a: 3, dist5b: 3, dist5c: 3, dist5d: 3, dist5e: 3,
        dist5f: 3, dist5g: 3, dist5h: 3, dist5i: 3, dist5j: 3,
        sleepMedication: 3,
        daySleepiness: 3,
        daytimeEnthusiasm: 3,
      }
      const r = scorePsqi(worst)
      expect(r.total).toBe(21)
      expect(r.poorSleepQuality).toBe(true)
    })
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

describe("scoreScreenTime", () => {
  it("flags highScreenTime when weekday or weekend duration is >3 jam/hari (value >= 3)", () => {
    expect(scoreScreenTime({ weekdayScreen: 3 }).highScreenTime).toBe(true)
    expect(scoreScreenTime({ weekendScreen: 3 }).highScreenTime).toBe(true)
    expect(scoreScreenTime({ weekdayScreen: 2, weekendScreen: 2 }).highScreenTime).toBe(false)
  })

  it("categorizes 'dalam batas wajar' when no risk signals present", () => {
    const r = scoreScreenTime({ weekdayScreen: 1, weekendScreen: 1, socialCompare: 0, cyberbullying: 0, sleepDelay: 0 })
    expect(r.category).toBe("Dalam batas wajar")
    expect(r.recommendation).toBeNull()
  })

  it("categorizes high screen time + distress combined", () => {
    const r = scoreScreenTime({ weekdayScreen: 4, weekendScreen: 4, socialCompare: 4, cyberbullying: 2, sleepDelay: 3 })
    expect(r.highScreenTime).toBe(true)
    expect(r.category).toBe("Screen time tinggi disertai indikator distres media sosial")
    expect(r.recommendation).not.toBeNull()
  })

  it("categorizes distress signal alone (low screen time but cyberbullying reported)", () => {
    const r = scoreScreenTime({ weekdayScreen: 1, weekendScreen: 1, cyberbullying: 1 })
    expect(r.highScreenTime).toBe(false)
    expect(r.category).toBe("Indikator distres media sosial")
  })

  it("sums the 5 ordinal fields only, excluding platforms", () => {
    const r = scoreScreenTime({ weekdayScreen: 2, weekendScreen: 2, socialCompare: 2, cyberbullying: 1, sleepDelay: 1, platforms: [0, 1, 2] })
    expect(r.total).toBe(8)
  })

  it("treats missing fields as 0", () => {
    expect(scoreScreenTime({}).total).toBe(0)
  })
})

describe("climateScoreFromBullyingRelation", () => {
  it("returns null when the relation is null/undefined", () => {
    expect(climateScoreFromBullyingRelation(null)).toBeNull()
    expect(climateScoreFromBullyingRelation(undefined)).toBeNull()
  })

  it("parses the JSON answers and computes the Climate School total (item 5-12 only)", () => {
    const answers = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 1, 6: 1, 7: 1, 8: 1, 9: 4, 10: 4, 11: 1, 12: 1 } // GBS items ignored, best-case climate
    const result = climateScoreFromBullyingRelation({ answers: JSON.stringify(answers) })
    expect(result).toBe(8) // matches scoreClimateSchool's minimum total
  })

  it("returns null on malformed JSON instead of throwing", () => {
    expect(climateScoreFromBullyingRelation({ answers: "not json" })).toBeNull()
  })
})
