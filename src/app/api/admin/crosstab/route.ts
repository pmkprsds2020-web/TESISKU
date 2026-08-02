import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/crosstab
// Body: { var1: "gender"|"school"|"age"|"classGrade"|"highRisk", var2: same }
// Returns: cross-tabulation counts + chi-square test
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { var1, var2 } = await req.json()
  const validVars = ["gender", "school", "age", "classGrade", "highRisk", "parentIncome", "residence"]
  if (!validVars.includes(var1) || !validVars.includes(var2) || var1 === var2) {
    return NextResponse.json({ error: "Invalid variables" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { status: "completed" },
    include: { demographic: true, cesdr: true },
  })

  // Extract variable value per respondent
  const getValue = (r: typeof respondents[number], v: string): string => {
    if (v === "highRisk") return r.highRisk ? "High Risk" : "Tidak"
    if (v === "school") return r.school ?? "Tidak diketahui"
    const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
    return demo[v] ?? "Tidak diketahui"
  }

  // Build cross-tab
  const rowValues = new Set<string>()
  const colValues = new Set<string>()
  const cells: Record<string, Record<string, number>> = {}

  for (const r of respondents) {
    const rv = getValue(r, var1)
    const cv = getValue(r, var2)
    rowValues.add(rv)
    colValues.add(cv)
    if (!cells[rv]) cells[rv] = {}
    cells[rv][cv] = (cells[rv][cv] ?? 0) + 1
  }

  const rows = Array.from(rowValues).sort()
  const cols = Array.from(colValues).sort()
  const N = respondents.length

  // Build matrix
  const matrix = rows.map(rv => cols.map(cv => cells[rv]?.[cv] ?? 0))
  const rowTotals = matrix.map(row => row.reduce((a, b) => a + b, 0))
  const colTotals = cols.map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0))

  // Chi-square test
  let chiSquare = 0
  const expected: number[][] = matrix.map((row, i) =>
    row.map((_, j) => (rowTotals[i] * colTotals[j]) / N)
  )
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      const exp = expected[i][j]
      if (exp > 0) {
        chiSquare += Math.pow(matrix[i][j] - exp, 2) / exp
      }
    }
  }
  const df = (rows.length - 1) * (cols.length - 1)

  // P-value from chi-square distribution
  const pValue = df > 0 ? chiSquarePValue(chiSquare, df) : 1

  // Cramér's V (effect size for chi-square)
  const cramersV = N > 0 ? Math.sqrt(chiSquare / (N * Math.min(rows.length - 1, cols.length - 1))) : 0
  const vInterpretation = cramersV < 0.1 ? "Sangat lemah" : cramersV < 0.3 ? "Lemah" : cramersV < 0.5 ? "Sedang" : "Kuat"

  return NextResponse.json({
    var1,
    var2,
    rows,
    cols,
    matrix,
    expected,
    rowTotals,
    colTotals,
    N,
    chiSquare: {
      statistic: Math.round(chiSquare * 1000) / 1000,
      df,
      pValue: Math.round(pValue * 10000) / 10000,
      significant: pValue < 0.05,
      description: `χ²(${df}) = ${Math.round(chiSquare * 1000) / 1000}, p = ${pValue < 0.001 ? "<0.001" : Math.round(pValue * 10000) / 10000}. ${pValue < 0.05 ? "Hubungan signifikan" : "Tidak ada hubungan signifikan"} pada α=0.05.`,
      effectSize: { name: "Cramér's V", value: Math.round(cramersV * 1000) / 1000, interpretation: vInterpretation },
    },
  })
}

// Chi-square P-value using the incomplete gamma function
function chiSquarePValue(chi2: number, df: number): number {
  if (chi2 <= 0) return 1
  // P(x > chi2) = 1 - P(x <= chi2) = 1 - lower incomplete gamma(df/2, chi2/2) / Gamma(df/2)
  const x = chi2 / 2
  const a = df / 2
  return 1 - lowerIncompleteGamma(a, x)
}

// Lower incomplete gamma function P(a, x) = γ(a, x) / Γ(a)
function lowerIncompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    // Series expansion
    let term = 1 / a
    let sum = term
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-10) break
    }
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * sum
  } else {
    // Continued fraction
    return 1 - upperIncompleteGamma(a, x)
  }
}

function upperIncompleteGamma(a: number, x: number): number {
  // Q(a, x) using continued fraction (Lentz's algorithm)
  const tiny = 1e-30
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i <= 100; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-10) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

function logGamma(x: number): number {
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  }
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i)
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
