import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/moderation
// Body: { predictor: string, moderator: string, outcome: string }
// Returns: moderation analysis with interaction effect + simple slopes
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { predictor, moderator, outcome } = await req.json()
  const valid = ["cesdr", "psqi", "mos", "bullying", "religiosity", "age"]
  if (!valid.includes(predictor) || !valid.includes(moderator) || !valid.includes(outcome)) {
    return NextResponse.json({ error: "Invalid variables" }, { status: 400 })
  }
  if (predictor === moderator || moderator === outcome || predictor === outcome) {
    return NextResponse.json({ error: "Variabel harus berbeda" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { status: "completed" },
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

  const data: { x: number; w: number; y: number }[] = []
  for (const r of respondents) {
    const x = getScore(r, predictor)
    const w = getScore(r, moderator)
    const y = getScore(r, outcome)
    if (x === null || w === null || y === null) continue
    data.push({ x, w, y })
  }

  if (data.length < 10) {
    return NextResponse.json({ error: `Data tidak cukup (${data.length}, minimal 10)` })
  }

  const n = data.length

  // Standardize X and W for meaningful interaction
  const meanX = data.reduce((a, b) => a + b.x, 0) / n
  const meanW = data.reduce((a, b) => a + b.w, 0) / n
  const sdX = Math.sqrt(data.reduce((s, d) => s + (d.x - meanX) ** 2, 0) / (n - 1))
  const sdW = Math.sqrt(data.reduce((s, d) => s + (d.w - meanW) ** 2, 0) / (n - 1))

  if (sdX === 0 || sdW === 0) {
    return NextResponse.json({ error: "Salah satu variabel memiliki varians nol" })
  }

  // Centered variables
  const cx = data.map(d => (d.x - meanX) / sdX)
  const cw = data.map(d => (d.w - meanW) / sdW)
  const inter = cx.map((x, i) => x * cw[i])
  const y = data.map(d => d.y)

  // Moderation model: Y = b0 + b1*X + b2*W + b3*X*W
  const X: number[][] = data.map((_, i) => [1, cx[i], cw[i], inter[i]])
  const beta = solveOLS(X, y)

  // Predictions and residuals
  const yPred = X.map(row => row.reduce((sum, x, i) => sum + x * beta[i], 0))
  const residuals = y.map((yi, i) => yi - yPred[i])
  const ssRes = residuals.reduce((s, r) => s + r * r, 0)
  const meanY = y.reduce((a, b) => a + b, 0) / n
  const ssTotal = y.reduce((s, yi) => s + (yi - meanY) ** 2, 0)
  const rSquared = ssTotal > 0 ? 1 - ssRes / ssTotal : 0

  // Standard errors
  const sigmaSq = ssRes / (n - 4)
  const XtX = matMul(transpose(X), X)
  const XtXInv = matrixInverse(XtX)
  const seBeta = XtXInv ? XtXInv.map((row, i) => Math.sqrt(Math.max(0, sigmaSq * row[i]))) : [0, 0, 0, 0]
  const tStats = beta.map((b, i) => seBeta[i] > 0 ? b / seBeta[i] : 0)
  const pValues = tStats.map(t => 2 * (1 - normalCDF(Math.abs(t))))

  // F-test for overall model
  const msReg = (ssTotal - ssRes) / 3
  const msRes = ssRes / (n - 4)
  const fStat = msRes > 0 ? msReg / msRes : 0
  const fP = fDistPValue(fStat, 3, n - 4)

  // Delta R² for interaction (compare model with vs without interaction)
  // Model without interaction: Y = b0 + b1*X + b2*W
  const X2: number[][] = data.map((_, i) => [1, cx[i], cw[i]])
  const beta2 = solveOLS(X2, y)
  const yPred2 = X2.map(row => row.reduce((sum, x, i) => sum + x * beta2[i], 0))
  const ssRes2 = y.reduce((s, yi, i) => s + (yi - yPred2[i]) ** 2, 0)
  const r2Without = ssTotal > 0 ? 1 - ssRes2 / ssTotal : 0
  const deltaR2 = rSquared - r2Without
  const fDelta = (deltaR2 / 1) / ((1 - rSquared) / (n - 4))
  const pDelta = fDistPValue(fDelta, 1, n - 4)

  // Simple slopes: effect of X on Y at W = -1SD, mean, +1SD
  const simpleSlopes = [
    { level: "Rendah (-1 SD)", w: -1 },
    { level: "Rata-rata (Mean)", w: 0 },
    { level: "Tinggi (+1 SD)", w: 1 },
  ].map(s => {
    // Slope of X at given W: b1 + b3 * W
    const slope = beta[1] + beta[3] * s.w
    // SE of slope: sqrt(var(b1) + w^2 * var(b3) + 2*w*cov(b1,b3))
    const varB1 = XtXInv ? XtXInv[1][1] * sigmaSq : 0
    const varB3 = XtXInv ? XtXInv[3][3] * sigmaSq : 0
    const covB1B3 = XtXInv ? XtXInv[1][3] * sigmaSq : 0
    const seSlope = Math.sqrt(Math.max(0, varB1 + s.w ** 2 * varB3 + 2 * s.w * covB1B3))
    const tSlope = seSlope > 0 ? slope / seSlope : 0
    const pSlope = 2 * (1 - normalCDF(Math.abs(tSlope)))
    return {
      level: s.level,
      w: s.w,
      slope: Math.round(slope * 1000) / 1000,
      se: Math.round(seSlope * 1000) / 1000,
      t: Math.round(tSlope * 1000) / 1000,
      p: Math.round(pSlope * 10000) / 10000,
      significant: pSlope < 0.05,
    }
  })

  // Interaction plot data: predicted Y at X levels × W levels
  const xLevels = [-1, -0.5, 0, 0.5, 1]
  const wLevels = [-1, 0, 1]
  const interactionPlot = xLevels.map(xv => {
    const point: Record<string, number> = { x: xv }
    wLevels.forEach((wv, wi) => {
      const label = ["W Rendah", "W Mean", "W Tinggi"][wi]
      point[label] = Math.round((beta[0] + beta[1] * xv + beta[2] * wv + beta[3] * xv * wv) * 100) / 100
    })
    return point
  })

  const VAR_LABELS: Record<string, string> = {
    cesdr: "CESD-R", psqi: "PSQI", mos: "MOS", bullying: "Bullying", religiosity: "Religiusitas", age: "Usia",
  }

  const hasInteraction = pValues[3] < 0.05

  return NextResponse.json({
    predictor, moderator, outcome,
    predictorLabel: VAR_LABELS[predictor],
    moderatorLabel: VAR_LABELS[moderator],
    outcomeLabel: VAR_LABELS[outcome],
    n,
    coefficients: [
      { name: "Intercept", beta: Math.round(beta[0] * 1000) / 1000, se: Math.round(seBeta[0] * 1000) / 1000, t: Math.round(tStats[0] * 1000) / 1000, p: Math.round(pValues[0] * 10000) / 10000 },
      { name: `X (${VAR_LABELS[predictor]})`, beta: Math.round(beta[1] * 1000) / 1000, se: Math.round(seBeta[1] * 1000) / 1000, t: Math.round(tStats[1] * 1000) / 1000, p: Math.round(pValues[1] * 10000) / 10000, significant: pValues[1] < 0.05 },
      { name: `W (${VAR_LABELS[moderator]})`, beta: Math.round(beta[2] * 1000) / 1000, se: Math.round(seBeta[2] * 1000) / 1000, t: Math.round(tStats[2] * 1000) / 1000, p: Math.round(pValues[2] * 10000) / 10000, significant: pValues[2] < 0.05 },
      { name: `X × W (Interaksi)`, beta: Math.round(beta[3] * 1000) / 1000, se: Math.round(seBeta[3] * 1000) / 1000, t: Math.round(tStats[3] * 1000) / 1000, p: Math.round(pValues[3] * 10000) / 10000, significant: pValues[3] < 0.05 },
    ],
    modelFit: {
      rSquared: Math.round(rSquared * 1000) / 1000,
      r2WithoutInteraction: Math.round(r2Without * 1000) / 1000,
      deltaR2: Math.round(deltaR2 * 1000) / 1000,
      fDelta: Math.round(fDelta * 1000) / 1000,
      pDelta: Math.round(pDelta * 10000) / 10000,
      fStat: Math.round(fStat * 1000) / 1000,
      fP: Math.round(fP * 10000) / 10000,
    },
    simpleSlopes,
    interactionPlot,
    hasInteraction,
    description: `Moderasi: ${VAR_LABELS[predictor]} × ${VAR_LABELS[moderator]} → ${VAR_LABELS[outcome]}. Interaksi ${hasInteraction ? "signifikan" : "tidak signifikan"} (β₃ = ${Math.round(beta[3] * 1000) / 1000}, p = ${pValues[3] < 0.001 ? "<0.001" : Math.round(pValues[3] * 10000) / 10000}). ΔR² = ${Math.round(deltaR2 * 1000) / 1000}.`,
  })
}

function solveOLS(X: number[][], y: number[]): number[] {
  const Xt = transpose(X)
  const XtX = matMul(Xt, X)
  const Xty = matVec(Xt, y)
  const aug = XtX.map((row, i) => [...row, Xty[i]])
  const n = aug.length
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-12) continue
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col] / aug[col][col]
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  return aug.map(row => row[n] / (row.find((v, i) => i < n && Math.abs(v) > 1e-12) || 1))
}

function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map(row => row[j]))
}

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length, cols = b[0].length, inner = b.length
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      Array.from({ length: inner }, (_, k) => a[i][k] * b[k][j]).reduce((s, v) => s + v, 0)
    )
  )
}

function matVec(m: number[][], v: number[]): number[] {
  return m.map(row => row.reduce((sum, x, i) => sum + x * v[i], 0))
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

function fDistPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1
  const x = df2 / (df2 + df1 * f)
  return incompleteBeta(df2 / 2, df1 / 2, x)
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lbeta = Math.log(x) * a + Math.log(1 - x) * b - Math.log(a + b) - logGamma(a) - logGamma(b) + logGamma(a + b)
  const front = Math.exp(lbeta) / a
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d; f = d
  for (let m = 1; m <= 100; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d; f *= d * c
    const bb = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1))
    d = 1 + bb * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + bb / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d; const delta = d * c; f *= delta
    if (Math.abs(delta - 1) < 1e-10) break
  }
  return front * f
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
