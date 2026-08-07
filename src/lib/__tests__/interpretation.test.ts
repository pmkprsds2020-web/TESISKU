import { describe, it, expect } from "vitest"
import {
  interpretCesdr,
  interpretPsqi,
  interpretMos,
  interpretGBS,
  interpretReligiosity,
  buildScreeningAnalysis,
  buildConclusion,
  buildClinicalNarrative,
  buildRecommendations,
} from "../interpretation"

describe("interpretCesdr", () => {
  it("flags bermakna at >= 16", () => {
    expect(interpretCesdr(16).warn).toBe(true)
    expect(interpretCesdr(15).warn).toBe(false)
  })
})

describe("interpretPsqi", () => {
  it("flags buruk at > 5", () => {
    expect(interpretPsqi(6).warn).toBe(true)
    expect(interpretPsqi(5).warn).toBe(false)
  })
})

describe("interpretMos", () => {
  it("flags rendah at <= 25", () => {
    expect(interpretMos(25).warn).toBe(true)
    expect(interpretMos(26).warn).toBe(false)
  })
})

describe("interpretGBS", () => {
  it("categorizes tiers", () => {
    expect(interpretGBS(0).category).toBe("Tidak ada indikasi perundungan")
    expect(interpretGBS(4).category).toBe("Indikasi ringan")
    expect(interpretGBS(5).category).toBe("Indikasi sedang-berat")
    expect(interpretGBS(5).warn).toBe(true)
  })
})

describe("interpretReligiosity", () => {
  it("flags kurang below 20", () => {
    expect(interpretReligiosity(19).category).toBe("Religiusitas kurang")
    expect(interpretReligiosity(20).category).toBe("Religiusitas baik")
  })
})

describe("buildScreeningAnalysis / buildConclusion / buildClinicalNarrative / buildRecommendations", () => {
  it("builds a full at-risk profile with matching conclusion & recommendations", () => {
    const analysis = buildScreeningAnalysis({
      cesdr: 20,
      cesdrHighRisk: false,
      psqi: 8,
      mos: 15,
      gbs: 6,
      bullyingAnswers: { 5: 4, 6: 4, 7: 4, 8: 4, 9: 1, 10: 1, 11: 4, 12: 4 }, // worst case climate
      religiosity: 12,
    })

    expect(analysis.find((a) => a.key === "cesdr")?.warn).toBe(true)
    expect(analysis.find((a) => a.key === "psqi")?.warn).toBe(true)
    expect(analysis.find((a) => a.key === "mos")?.warn).toBe(true)
    expect(analysis.find((a) => a.key === "gbs")?.warn).toBe(true)
    expect(analysis.find((a) => a.key === "climate")?.warn).toBe(true)
    expect(analysis.find((a) => a.key === "religiosity")?.warn).toBe(true)

    const conclusion = buildConclusion(analysis)
    expect(conclusion.length).toBeGreaterThan(0)
    expect(conclusion.some((l) => l.includes("depresi bermakna"))).toBe(true)

    const narrative = buildClinicalNarrative(analysis)
    expect(narrative.length).toBeGreaterThan(0)
    expect(narrative).toContain("asesmen lanjutan")

    const recs = buildRecommendations(analysis)
    expect(recs.length).toBeGreaterThan(0)
    // no duplicate recommendations
    expect(new Set(recs).size).toBe(recs.length)
  })

  it("builds a healthy profile with no forced-risk recommendations", () => {
    const analysis = buildScreeningAnalysis({
      cesdr: 5,
      cesdrHighRisk: false,
      psqi: 2,
      mos: 45,
      gbs: 0,
      bullyingAnswers: { 5: 1, 6: 1, 7: 1, 8: 1, 9: 4, 10: 4, 11: 1, 12: 1 }, // best case climate
      religiosity: 28,
    })
    expect(analysis.every((a) => !a.warn)).toBe(true)
    const recs = buildRecommendations(analysis)
    expect(recs.length).toBe(0)
  })

  it("handles missing data gracefully", () => {
    const analysis = buildScreeningAnalysis({
      cesdr: null,
      cesdrHighRisk: false,
      psqi: null,
      mos: null,
      gbs: null,
      bullyingAnswers: null,
      religiosity: null,
    })
    expect(analysis.every((a) => a.score === null)).toBe(true)
    expect(buildConclusion(analysis)).toEqual([])
    expect(buildClinicalNarrative(analysis)).toContain("belum lengkap")
  })
})
