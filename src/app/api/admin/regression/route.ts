import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { climateScoreFromBullyingRelation } from "@/lib/scoring"

// POST /api/admin/regression
// Body: { outcome: "cesdr"|"psqi"|"mos"|"bullying"|"climate"|"religiosity", predictors: string[] }
// Returns: multiple linear regression coefficients, R², F-test, p-values
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { outcome, predictors } = await req.json()
  const validMetrics = ["cesdr", "psqi", "mos", "bullying", "climate", "religiosity"]
  const validPredictors = ["psqi", "mos", "bullying", "climate", "religiosity", "age"]

  if (!validMetrics.includes(outcome) || !Array.isArray(predictors) || predictors.length < 1) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
  }
  // Remove outcome from predictors if present
  const cleanPredictors = predictors.filter((p: string) => validPredictors.includes(p) && p !== outcome)
  if (cleanPredictors.length === 0) {
    return NextResponse.json({ error: "No valid predictors" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { projectId: admin, status: "completed" },
    include: {
      demographic: true,
      cesdr: true,
      psqi: true,
      mos: true,
      bullying: true,
      religiosity: true,
    },
  })

  // Build data matrix
  const getScore = (r: typeof respondents[number], metric: string): number | null => {
    switch (metric) {
      case "cesdr": return r.cesdr?.totalScore ?? null
      case "psqi": return r.psqi?.totalScore ?? null
      case "mos": return r.mos?.totalScore ?? null
      case "bullying": return r.bullying?.victimScore ?? null // GBS (item 1-4)
      case "climate": return climateScoreFromBullyingRelation(r.bullying) // Climate School (item 5-12)
      case "religiosity": return r.religiosity?.totalScore ?? null
      case "age": {
        const demo = r.demographic ? (JSON.parse(r.demographic.data) as Record<string, string>) : {}
        return demo.age ? Number(demo.age) : null
      }
      default: return null
    }
  }

  // Filter respondents with all required scores
  const data: { y: number; x: number[] }[] = []
  for (const r of respondents) {
    const y = getScore(r, outcome)
    if (y === null) continue
    const x = cleanPredictors.map((p: string) => getScore(r, p))
    if (x.some((v) => v === null)) continue
    data.push({ y, x: x as number[] })
  }

  if (data.length < cleanPredictors.length + 2) {
    return NextResponse.json({
      error: `Insufficient data (${data.length} cases, need at least ${cleanPredictors.length + 2})`,
    })
  }

  const n = data.length
  const k = cleanPredictors.length

  // Multiple linear regression via normal equations: β = (X'X)^{-1} X'y
  // Build X with intercept column
  const X: number[][] = data.map(d => [1, ...d.x])
  const y: number[] = data.map(d => d.y)

  // Compute X'X (k+1 × k+1)
  const XtX: number[][] = Array.from({ length: k + 1 }, () => Array(k + 1).fill(0))
  for (let i = 0; i < n; i++) {
    for (let a = 0; a <= k; a++) {
      for (let b = 0; b <= k; b++) {
        XtX[a][b] += X[i][a] * X[i][b]
      }
    }
  }

  // Compute X'y (k+1 vector)
  const Xty: number[] = Array(k + 1).fill(0)
  for (let i = 0; i < n; i++) {
    for (let a = 0; a <= k; a++) {
      Xty[a] += X[i][a] * y[i]
    }
  }

  // Solve (X'X)β = X'y using Gaussian elimination with partial pivoting
  const aug = XtX.map((row, i) => [...row, Xty[i]])
  for (let col = 0; col <= k; col++) {
    // Find pivot
    let maxRow = col
    for (let row = col + 1; row <= k; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-10) {
      return NextResponse.json({
        error: "Multikolinearitas terdeteksi — salah satu prediktor memiliki varians nol atau berkorelasi sempurna dengan prediktor lain. Hapus prediktor yang bermasalah dan coba lagi.",
      })
    }
    for (let row = 0; row <= k; row++) {
      if (row === col) continue
      const factor = aug[row][col] / aug[col][col]
      for (let j = col; j <= k + 1; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }
  const beta: number[] = aug.map((row) => row[k + 1] / row[row.findIndex((_, i) => i <= k && Math.abs(row[i]) > 1e-10)])

  // Predictions and residuals
  const yPred = X.map((row) => row.reduce((sum, x, i) => sum + x * beta[i], 0))
  const residuals = y.map((yi, i) => yi - yPred[i])

  // R²
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const ssTotal = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0)
  const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0)
  const ssRegression = ssTotal - ssResidual
  const rSquared = ssTotal > 0 ? ssRegression / ssTotal : 0
  const adjustedR2 = 1 - (1 - rSquared) * (n - 1) / (n - k - 1)

  // F-test for overall significance
  const msRegression = ssRegression / k
  const msResidual = ssResidual / (n - k - 1)
  const fStatistic = msResidual > 0 ? msRegression / msResidual : 0
  const fPValue = fDistPValue(fStatistic, k, n - k - 1)

  // Standard errors of coefficients
  // Var(β) = σ² (X'X)^{-1}, where σ² = MSresidual
  const sigmaSq = msResidual
  // Compute (X'X)^{-1} via Gauss-Jordan (already have augmented, extract inverse)
  const XtXInv = matrixInverse(XtX)
  const seBeta: number[] = []
  const tStats: number[] = []
  const pValues: number[] = []
  const dfResidual = n - k - 1
  for (let i = 0; i <= k; i++) {
    const se = Math.sqrt(sigmaSq * (XtXInv[i][i] || 0))
    seBeta.push(se)
    const t = se > 0 ? beta[i] / se : 0
    tStats.push(t)
    // p-value from the t-distribution with residual df (was: normal approximation)
    pValues.push(tDistPValue(t, dfResidual))
  }

  // Standardized coefficients (beta *)
  const ySD = Math.sqrt(y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0) / (n - 1))
  const xSDs = cleanPredictors.map((_: string, j: number) => {
    const xMean = data.reduce((sum, d) => sum + d.x[j], 0) / n
    return Math.sqrt(data.reduce((sum, d) => sum + (d.x[j] - xMean) ** 2, 0) / (n - 1))
  })
  const standardizedBeta = beta.slice(1).map((b, j) => (xSDs[j] > 0 && ySD > 0 ? b * (xSDs[j] / ySD) : 0))

  return NextResponse.json({
    outcome,
    predictors: cleanPredictors,
    n,
    coefficients: [
      { name: "Intercept", beta: beta[0], se: seBeta[0], t: tStats[0], pValue: pValues[0], standardized: null },
      ...cleanPredictors.map((p: string, j: number) => ({
        name: p,
        label: PREDICTOR_LABELS[p] || p,
        beta: Math.round(beta[j + 1] * 1000) / 1000,
        se: Math.round(seBeta[j + 1] * 1000) / 1000,
        t: Math.round(tStats[j + 1] * 1000) / 1000,
        pValue: Math.round(pValues[j + 1] * 10000) / 10000,
        standardized: Math.round(standardizedBeta[j] * 1000) / 1000,
        significant: pValues[j + 1] < 0.05,
      })),
    ],
    modelFit: {
      rSquared: Math.round(rSquared * 1000) / 1000,
      adjustedR2: Math.round(adjustedR2 * 1000) / 1000,
      fStatistic: Math.round(fStatistic * 1000) / 1000,
      fPValue: Math.round(fPValue * 10000) / 10000,
      fDf1: k,
      fDf2: n - k - 1,
      rmse: Math.sqrt(msResidual),
    },
    description: `R² = ${Math.round(rSquared * 1000) / 1000} (model menjelaskan ${Math.round(rSquared * 100)}% varians). F(${k}, ${n - k - 1}) = ${Math.round(fStatistic * 1000) / 1000}, p = ${fPValue < 0.001 ? "<0.001" : Math.round(fPValue * 10000) / 10000}. ${fPValue < 0.05 ? "Model signifikan" : "Model tidak signifikan"}.`,
  })
}

const PREDICTOR_LABELS: Record<string, string> = {
  psqi: "PSQI (Tidur)",
  mos: "MOS-SSS (Dukungan)",
  bullying: "Bullying (GBS)",
  climate: "Climate School",
  religiosity: "Religiusitas",
  age: "Usia",
}

// Matrix inverse via Gauss-Jordan elimination
function matrixInverse(m: number[][]): number[][] {
  const n = m.length
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-10) continue
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  return aug.map(row => row.slice(n))
}

// Standard normal CDF
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

// F-distribution p-value
function fDistPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1
  const x = df2 / (df2 + df1 * f)
  return incompleteBeta(df2 / 2, df1 / 2, x)
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  // BUGFIX: previous version subtracted an extra log(a+b) term, distorting every
  // F-distribution / t-distribution p-value by a factor of 1/(a+b).
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
