import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/logistic
// Body: { predictors: string[] }
// Predicts high-risk (binary) using logistic regression (Newton-Raphson / IRLS)
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { predictors } = await req.json()
  const validPredictors = ["psqi", "mos", "bullying", "religiosity", "age"]
  if (!Array.isArray(predictors) || predictors.length === 0) {
    return NextResponse.json({ error: "No predictors" }, { status: 400 })
  }
  const cleanPredictors = predictors.filter((p: string) => validPredictors.includes(p))
  if (cleanPredictors.length === 0) {
    return NextResponse.json({ error: "No valid predictors" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { status: "completed" },
    include: {
      demographic: true,
      psqi: true,
      mos: true,
      bullying: true,
      religiosity: true,
      cesdr: true,
    },
  })

  const getScore = (r: typeof respondents[number], metric: string): number | null => {
    switch (metric) {
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

  // Build data: y = highRisk (0/1), X = predictors
  const data: { y: number; x: number[] }[] = []
  for (const r of respondents) {
    const y = r.highRisk ? 1 : 0
    const x = cleanPredictors.map((p: string) => getScore(r, p))
    if (x.some(v => v === null)) continue
    data.push({ y, x: x as number[] })
  }

  if (data.length < 5) {
    return NextResponse.json({ error: `Data tidak cukup (${data.length}, minimal 5)` })
  }

  // Check we have both classes
  const positives = data.filter(d => d.y === 1).length
  const negatives = data.length - positives
  if (positives === 0 || negatives === 0) {
    return NextResponse.json({ error: "Hanya satu kelas (semua high-risk atau semua tidak) — tidak bisa klasifikasi" })
  }

  const n = data.length
  const k = cleanPredictors.length
  const p = k + 1 // intercept + predictors

  // Design matrix with intercept
  const X = data.map(d => [1, ...d.x])
  const y = data.map(d => d.y)

  // Newton-Raphson / IRLS for logistic regression
  let beta = new Array(p).fill(0)
  const maxIter = 50
  let converged = false
  let logLik = 0

  for (let iter = 0; iter < maxIter; iter++) {
    // Compute probabilities
    const probs = X.map(row => {
      const z = row.reduce((sum, x, i) => sum + x * beta[i], 0)
      return 1 / (1 + Math.exp(-z))
    })

    // Gradient (X'(y - p))
    const grad = new Array(p).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        grad[j] += X[i][j] * (y[i] - probs[i])
      }
    }

    // Hessian: -X'WX where W = diag(p(1-p))
    const W = probs.map(pr => pr * (1 - pr))
    const hessian: number[][] = Array.from({ length: p }, () => new Array(p).fill(0))
    for (let a = 0; a < p; a++) {
      for (let b = 0; b < p; b++) {
        for (let i = 0; i < n; i++) {
          hessian[a][b] -= X[i][a] * X[i][b] * W[i]
        }
      }
    }

    // Solve hessian * delta = grad (negative because hessian is negative)
    const negHessian = hessian.map(row => row.map(v => -v))
    const delta = solveLinear(negHessian, grad)
    if (!delta) break

    const newBeta = beta.map((b, i) => b + delta[i])

    // Check convergence
    const maxDelta = Math.max(...delta.map(Math.abs))
    if (maxDelta < 1e-6) {
      converged = true
      beta = newBeta
      break
    }
    beta = newBeta
  }

  // Final probabilities and log-likelihood
  const probs = X.map(row => {
    const z = row.reduce((sum, x, i) => sum + x * beta[i], 0)
    return 1 / (1 + Math.exp(-z))
  })
  logLik = y.reduce((sum, yi, i) => {
    const pi = Math.max(1e-10, Math.min(1 - 1e-10, probs[i]))
    return sum + yi * Math.log(pi) + (1 - yi) * Math.log(1 - pi)
  }, 0)

  // Null model log-likelihood (intercept only)
  const p0 = positives / n
  const nullLogLik = positives * Math.log(p0) + negatives * Math.log(1 - p0)

  // Likelihood ratio test
  const lrStat = 2 * (logLik - nullLogLik)
  const lrPValue = lrChiSquarePValue(lrStat, k)

  // Pseudo R² (McFadden)
  const mcfaddenR2 = nullLogLik < 0 ? 1 - logLik / nullLogLik : 0

  // Standard errors from inverse Hessian
  const negHessian = Array.from({ length: p }, () => new Array(p).fill(0))
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      for (let i = 0; i < n; i++) {
        negHessian[a][b] -= X[i][a] * X[i][b] * probs[i] * (1 - probs[i])
      }
    }
  }
  const invHessian = matrixInverse(negHessian)
  const seBeta = invHessian ? invHessian.map((row, i) => Math.sqrt(Math.max(0, row[i]))) : new Array(p).fill(0)
  const zStats = beta.map((b, i) => seBeta[i] > 0 ? b / seBeta[i] : 0)
  const pValues = zStats.map(z => 2 * (1 - normalCDF(Math.abs(z))))

  // Odds ratios
  const oddsRatios = beta.map(b => Math.exp(b))

  // Classification accuracy
  const predictions = probs.map(p => p >= 0.5 ? 1 : 0)
  const correct = predictions.filter((pred, i) => pred === y[i]).length
  const accuracy = correct / n
  const truePos = predictions.filter((pred, i) => pred === 1 && y[i] === 1).length
  const falsePos = predictions.filter((pred, i) => pred === 1 && y[i] === 0).length
  const trueNeg = predictions.filter((pred, i) => pred === 0 && y[i] === 0).length
  const falseNeg = predictions.filter((pred, i) => pred === 0 && y[i] === 1).length
  const sensitivity = truePos + falseNeg > 0 ? truePos / (truePos + falseNeg) : 0
  const specificity = trueNeg + falsePos > 0 ? trueNeg / (trueNeg + falsePos) : 0

  // ROC curve: compute TPR and FPR at multiple thresholds
  const rocPoints: { threshold: number; tpr: number; fpr: number }[] = []
  const sortedProbs = [...probs].sort((a, b) => b - a)
  const thresholds = [0, ...sortedProbs, 1]
  for (const thresh of thresholds) {
    const tp = probs.filter((p, i) => p >= thresh && y[i] === 1).length
    const fp = probs.filter((p, i) => p >= thresh && y[i] === 0).length
    const fn = probs.filter((p, i) => p < thresh && y[i] === 1).length
    const tn = probs.filter((p, i) => p < thresh && y[i] === 0).length
    const tpr = tp + fn > 0 ? tp / (tp + fn) : 0
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0
    rocPoints.push({ threshold: Math.round(thresh * 1000) / 1000, tpr: Math.round(tpr * 1000) / 1000, fpr: Math.round(fpr * 1000) / 1000 })
  }

  // AUC using trapezoidal rule (sort by FPR ascending)
  const aucPoints = [...rocPoints].sort((a, b) => a.fpr - b.fpr)
  let auc = 0
  for (let i = 1; i < aucPoints.length; i++) {
    const dx = aucPoints[i].fpr - aucPoints[i - 1].fpr
    auc += dx * (aucPoints[i].tpr + aucPoints[i - 1].tpr) / 2
  }
  auc = Math.max(0, Math.min(1, auc))

  // Find optimal threshold (Youden's J = max(TPR - FPR))
  let optimalThreshold = 0.5
  let maxJ = -1
  for (const pt of rocPoints) {
    const j = pt.tpr - pt.fpr
    if (j > maxJ) {
      maxJ = j
      optimalThreshold = pt.threshold
    }
  }

  const PREDICTOR_LABELS: Record<string, string> = {
    psqi: "PSQI (Tidur)",
    mos: "MOS-SSS (Dukungan)",
    bullying: "Bullying",
    religiosity: "Religiusitas",
    age: "Usia",
  }

  return NextResponse.json({
    predictors: cleanPredictors,
    n,
    positives,
    negatives,
    converged,
    coefficients: [
      { name: "Intercept", beta: beta[0], se: seBeta[0], z: zStats[0], pValue: pValues[0], oddsRatio: oddsRatios[0] },
      ...cleanPredictors.map((p: string, j: number) => ({
        name: p,
        label: PREDICTOR_LABELS[p] || p,
        beta: Math.round(beta[j + 1] * 1000) / 1000,
        se: Math.round(seBeta[j + 1] * 1000) / 1000,
        z: Math.round(zStats[j + 1] * 1000) / 1000,
        pValue: Math.round(pValues[j + 1] * 10000) / 10000,
        oddsRatio: Math.round(oddsRatios[j + 1] * 1000) / 1000,
        significant: pValues[j + 1] < 0.05,
      })),
    ],
    modelFit: {
      logLikelihood: Math.round(logLik * 1000) / 1000,
      nullLogLikelihood: Math.round(nullLogLik * 1000) / 1000,
      lrStatistic: Math.round(lrStat * 1000) / 1000,
      lrPValue: Math.round(lrPValue * 10000) / 10000,
      mcfaddenR2: Math.round(mcfaddenR2 * 1000) / 1000,
    },
    classification: {
      accuracy: Math.round(accuracy * 1000) / 1000,
      sensitivity: Math.round(sensitivity * 1000) / 1000,
      specificity: Math.round(specificity * 1000) / 1000,
      truePos,
      falsePos,
      trueNeg,
      falseNeg,
    },
    roc: {
      auc: Math.round(auc * 1000) / 1000,
      points: rocPoints,
      optimalThreshold,
      youdensJ: Math.round(maxJ * 1000) / 1000,
      interpretation: auc >= 0.9 ? "Sangat baik (Excellent)" : auc >= 0.8 ? "Baik (Good)" : auc >= 0.7 ? "Cukup (Fair)" : auc >= 0.6 ? "Buruk (Poor)" : "Gagal (Fail)",
    },
    description: `Model memprediksi high-risk dengan akurasi ${Math.round(accuracy * 100)}%. McFadden R² = ${Math.round(mcfaddenR2 * 1000) / 1000}. LR χ²(${k}) = ${Math.round(lrStat * 1000) / 1000}, p = ${lrPValue < 0.001 ? '<0.001' : Math.round(lrPValue * 10000) / 10000}. ${lrPValue < 0.05 ? 'Model signifikan' : 'Model tidak signifikan'}.`,
  })
}

// Solve linear system Ax = b via Gaussian elimination
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length
  const aug = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-12) return null
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col] / aug[col][col]
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  return aug.map(row => row[n] / row[row.findIndex((v, i) => i < n && Math.abs(v) > 1e-12)])
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

function lrChiSquarePValue(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1
  const x = chi2 / 2
  const a = df / 2
  return 1 - lowerIncompleteGamma(a, x)
}

function lowerIncompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    let term = 1 / a
    let sum = term
    for (let nn = 1; nn < 100; nn++) {
      term *= x / (a + nn)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-10) break
    }
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * sum
  }
  return 1 - upperIncompleteGamma(a, x)
}

function upperIncompleteGamma(a: number, x: number): number {
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
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
