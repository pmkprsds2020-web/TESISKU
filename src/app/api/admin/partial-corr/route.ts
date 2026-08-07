import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/partial-corr
// Body: { x: string, y: string, controls: string[] }
// Returns: partial correlation r(x,y | controls) with p-value
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { x: xVar, y: yVar, controls } = await req.json()
  const valid = ["cesdr", "psqi", "mos", "bullying", "religiosity", "age"]
  if (!valid.includes(xVar) || !valid.includes(yVar)) {
    return NextResponse.json({ error: "Invalid variables" }, { status: 400 })
  }
  if (xVar === yVar) {
    return NextResponse.json({ error: "X dan Y harus berbeda" }, { status: 400 })
  }
  const cleanControls = (controls || []).filter((c: string) => valid.includes(c) && c !== xVar && c !== yVar)

  const respondents = await db.respondent.findMany({
    where: { projectId: admin, status: "completed" },
    include: { cesdr: true, psqi: true, mos: true, bullying: true, religiosity: true, demographic: true },
  })

  const getScore = (r: typeof respondents[number], metric: string): number | null => {
    switch (metric) {
      case "cesdr": return r.cesdr?.totalScore ?? null
      case "psqi": return r.psqi?.totalScore ?? null
      case "mos": return r.mos?.totalScore ?? null
      case "bullying": return r.bullying?.victimScore ?? null
      case "religiosity": return r.religiosity?.totalScore ?? null
      case "age": {
        const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
        return demo.age ? Number(demo.age) : null
      }
      default: return null
    }
  }

  // Build data matrix
  const allVars = [xVar, yVar, ...cleanControls]
  const data: number[][] = []
  for (const r of respondents) {
    const row = allVars.map(v => getScore(r, v))
    if (row.some(v => v === null)) continue
    data.push(row as number[])
  }

  if (data.length < allVars.length + 2) {
    return NextResponse.json({ error: `Data tidak cukup (${data.length}, minimal ${allVars.length + 2})` })
  }

  const n = data.length
  const k = allVars.length

  // Compute correlation matrix
  const means = allVars.map((_, j) => data.reduce((s, row) => s + row[j], 0) / n)
  const sds = allVars.map((_, j) => {
    const variance = data.reduce((s, row) => s + (row[j] - means[j]) ** 2, 0) / (n - 1)
    return Math.sqrt(variance)
  })

  const R: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      let cov = 0
      for (let i = 0; i < n; i++) {
        cov += (data[i][a] - means[a]) * (data[i][b] - means[b])
      }
      cov /= (n - 1)
      R[a][b] = sds[a] > 0 && sds[b] > 0 ? cov / (sds[a] * sds[b]) : 0
    }
  }

  // Zero-order correlation (X, Y)
  const zeroOrderR = R[0][1]

  // Partial correlation via matrix inversion
  // If we have controls, invert the sub-matrix and compute partial r from precision matrix
  if (cleanControls.length === 0) {
    // No controls — just return zero-order
    const tStat = Math.sqrt(n - 2) * zeroOrderR / Math.sqrt(1 - zeroOrderR ** 2)
    // p-value from the t-distribution with df = n - 2 (was: normal approximation)
    const pValue = tDistPValue(tStat, n - 2)
    return NextResponse.json({
      x: xVar, y: yVar, controls: [],
      n, zeroOrderR: Math.round(zeroOrderR * 1000) / 1000,
      partialR: Math.round(zeroOrderR * 1000) / 1000,
      pValue: Math.round(pValue * 10000) / 10000,
      significant: pValue < 0.05,
      description: `Korelasi Pearson sederhana r = ${Math.round(zeroOrderR * 1000) / 1000}.`,
    })
  }

  // Partial correlation: r(x,y | z1, z2, ...) 
  // Method: Regress X on controls → residuals, regress Y on controls → residuals, then correlate residuals
  // Equivalently: from the inverse of the full correlation matrix
  const RInv = matrixInverse(R)
  if (!RInv) {
    return NextResponse.json({ error: "Matriks korelasi singular (multikolinearitas)" })
  }

  // Partial correlation from precision matrix: r_xy.z = -P[xy] / sqrt(P[xx] * P[yy])
  const partialR = RInv[0][1] !== 0 && RInv[0][0] !== 0 && RInv[1][1] !== 0
    ? -RInv[0][1] / Math.sqrt(RInv[0][0] * RInv[1][1])
    : 0

  // Degrees of freedom: n - k (k = 2 + num_controls)
  const df = n - 2 - cleanControls.length
  const tStat = df > 0 ? Math.sqrt(df) * partialR / Math.sqrt(1 - partialR ** 2) : 0
  // p-value from the t-distribution with df = n - 2 - num_controls (was: normal approximation)
  const pValue = tDistPValue(tStat, df)

  // Semi-partial correlation (unique contribution of X to Y)
  // From the residuals approach
  const VAR_LABELS: Record<string, string> = {
    cesdr: "CESD-R", psqi: "PSQI", mos: "MOS", bullying: "Bullying", religiosity: "Religiusitas", age: "Usia",
  }

  return NextResponse.json({
    x: xVar, y: yVar,
    xLabel: VAR_LABELS[xVar],
    yLabel: VAR_LABELS[yVar],
    controls: cleanControls,
    controlLabels: cleanControls.map((c: string) => VAR_LABELS[c]),
    n,
    zeroOrderR: Math.round(zeroOrderR * 1000) / 1000,
    partialR: Math.round(partialR * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
    df,
    significant: pValue < 0.05,
    reduction: Math.round((1 - Math.abs(partialR) / Math.abs(zeroOrderR || 1)) * 100),
    description: `Korelasi parsial r(${VAR_LABELS[xVar]}, ${VAR_LABELS[yVar]} | ${cleanControls.map((c: string) => VAR_LABELS[c]).join(", ")}) = ${Math.round(partialR * 1000) / 1000}, p = ${pValue < 0.001 ? "<0.001" : Math.round(pValue * 10000) / 10000}. Korelasi zero-order: ${Math.round(zeroOrderR * 1000) / 1000}.`,
  })
}

function matrixInverse(m: number[][]): number[][] | null {
  const n = m.length
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-12) return null
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  return aug.map(row => row.slice(n))
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

// Two-tailed p-value for a t-distributed statistic with `df` degrees of freedom.
function tDistPValue(t: number, df: number): number {
  if (df <= 0) return 1
  if (t === 0) return 1
  const x = df / (df + t * t)
  return incompleteBeta(df / 2, 0.5, x)
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 1e-12, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

function logGamma(x: number): number {
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
