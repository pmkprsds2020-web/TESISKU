import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/mediation
// Body: { predictor: string, mediator: string, outcome: string }
// Returns: Baron & Kenny mediation analysis (4 steps) + Sobel test
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { predictor, mediator, outcome } = await req.json()
  const valid = ["cesdr", "psqi", "mos", "bullying", "religiosity", "age"]
  if (!valid.includes(predictor) || !valid.includes(mediator) || !valid.includes(outcome)) {
    return NextResponse.json({ error: "Invalid variables" }, { status: 400 })
  }
  if (predictor === mediator || mediator === outcome || predictor === outcome) {
    return NextResponse.json({ error: "Variabel harus berbeda" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { status: "completed" },
    include: {
      cesdr: true,
      psqi: true,
      mos: true,
      bullying: true,
      religiosity: true,
      demographic: true,
    },
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

  // Build triplets (X=predictor, M=mediator, Y=outcome)
  const data: { x: number; m: number; y: number }[] = []
  for (const r of respondents) {
    const x = getScore(r, predictor)
    const m = getScore(r, mediator)
    const y = getScore(r, outcome)
    if (x === null || m === null || y === null) continue
    data.push({ x, m, y })
  }

  if (data.length < 10) {
    return NextResponse.json({ error: `Data tidak cukup (${data.length}, minimal 10)` })
  }

  const n = data.length

  // Simple linear regression: y = a + b*x
  function linReg(ys: number[], xs: number[]) {
    const n = ys.length
    const meanX = xs.reduce((a, b) => a + b, 0) / n
    const meanY = ys.reduce((a, b) => a + b, 0) / n
    let ssXX = 0, ssXY = 0, ssYY = 0
    for (let i = 0; i < n; i++) {
      ssXX += (xs[i] - meanX) ** 2
      ssXY += (xs[i] - meanX) * (ys[i] - meanY)
      ssYY += (ys[i] - meanY) ** 2
    }
    const b = ssXX > 0 ? ssXY / ssXX : 0
    const a = meanY - b * meanX
    const ssRes = ys.reduce((sum, yi, i) => sum + (yi - (a + b * xs[i])) ** 2, 0)
    const se = Math.sqrt(ssRes / (n - 2)) / Math.sqrt(ssXX)
    const t = se > 0 ? b / se : 0
    const p = 2 * (1 - normalCDF(Math.abs(t)))
    const rSquared = ssYY > 0 ? 1 - ssRes / ssYY : 0
    return { a, b, se, t, p, rSquared }
  }

  // Step 1: Y = c*X (total effect)
  const step1 = linReg(data.map(d => d.y), data.map(d => d.x))

  // Step 2: M = a*X (effect of X on M)
  const step2 = linReg(data.map(d => d.m), data.map(d => d.x))

  // Step 3: Y = c'*X + b*M (direct effect + mediator effect)
  // Multiple regression: Y = b0 + c'X + bM
  const X: number[][] = data.map(d => [1, d.x, d.m])
  const y = data.map(d => d.y)
  const beta = solveOLS(X, y)
  const step3_c = beta[1] // direct effect (c')
  const step3_b = beta[2] // mediator effect (b)

  // SE for step 3
  const yPred3 = X.map(row => row.reduce((sum, x, i) => sum + x * beta[i], 0))
  const ssRes3 = y.reduce((sum, yi, i) => sum + (yi - yPred3[i]) ** 2, 0)
  const sigmaSq3 = ssRes3 / (n - 3)
  const XtX3 = matMul(transpose(X), X)
  const XtX3Inv = matrixInverse(XtX3)
  const se3 = XtX3Inv ? [Math.sqrt(sigmaSq3 * XtX3Inv[1][1]), Math.sqrt(sigmaSq3 * XtX3Inv[2][2])] : [0, 0]
  const t3_c = se3[0] > 0 ? step3_c / se3[0] : 0
  const t3_b = se3[1] > 0 ? step3_b / se3[1] : 0
  const p3_c = 2 * (1 - normalCDF(Math.abs(t3_c)))
  const p3_b = 2 * (1 - normalCDF(Math.abs(t3_b)))

  // Step 4: Indirect effect = a * b
  const indirectEffect = step2.b * step3_b

  // Sobel test
  const sobelSE = Math.sqrt(step3_b ** 2 * step2.se ** 2 + step2.b ** 2 * se3[1] ** 2)
  const sobelZ = sobelSE > 0 ? indirectEffect / sobelSE : 0
  const sobelP = 2 * (1 - normalCDF(Math.abs(sobelZ)))

  // Proportion mediated
  const proportionMediated = step1.b !== 0 ? indirectEffect / step1.b : 0

  // Mediation type
  let mediationType = "Tidak ada mediasi"
  if (step2.p < 0.05 && p3_b < 0.05) {
    if (Math.abs(step3_c) < 0.01 || p3_c >= 0.05) {
      mediationType = "Mediasi Penuh (Full Mediation)"
    } else if (Math.abs(step3_c) < Math.abs(step1.b)) {
      mediationType = "Mediasi Parsial (Partial Mediation)"
    } else {
      mediationType = "Mediasi Terdeteksi"
    }
  } else {
    mediationType = "Tidak ada mediasi signifikan"
  }

  const VAR_LABELS: Record<string, string> = {
    cesdr: "CESD-R (Depresi)",
    psqi: "PSQI (Tidur)",
    mos: "MOS-SSS (Dukungan)",
    bullying: "Bullying",
    religiosity: "Religiusitas",
    age: "Usia",
  }

  return NextResponse.json({
    predictor,
    mediator,
    outcome,
    predictorLabel: VAR_LABELS[predictor] || predictor,
    mediatorLabel: VAR_LABELS[mediator] || mediator,
    outcomeLabel: VAR_LABELS[outcome] || outcome,
    n,
    steps: {
      step1: {
        name: "Langkah 1: Y = c·X ( efek total)",
        c: Math.round(step1.b * 1000) / 1000,
        se: Math.round(step1.se * 1000) / 1000,
        t: Math.round(step1.t * 1000) / 1000,
        p: Math.round(step1.p * 10000) / 10000,
        rSquared: Math.round(step1.rSquared * 1000) / 1000,
        significant: step1.p < 0.05,
      },
      step2: {
        name: "Langkah 2: M = a·X (X → M)",
        a: Math.round(step2.b * 1000) / 1000,
        se: Math.round(step2.se * 1000) / 1000,
        t: Math.round(step2.t * 1000) / 1000,
        p: Math.round(step2.p * 10000) / 10000,
        rSquared: Math.round(step2.rSquared * 1000) / 1000,
        significant: step2.p < 0.05,
      },
      step3: {
        name: "Langkah 3: Y = c'·X + b·M ( efek langsung + mediator)",
        cPrime: Math.round(step3_c * 1000) / 1000,
        b: Math.round(step3_b * 1000) / 1000,
        seC: Math.round(se3[0] * 1000) / 1000,
        seB: Math.round(se3[1] * 1000) / 1000,
        tC: Math.round(t3_c * 1000) / 1000,
        tB: Math.round(t3_b * 1000) / 1000,
        pC: Math.round(p3_c * 10000) / 10000,
        pB: Math.round(p3_b * 10000) / 10000,
        cSignificant: p3_c < 0.05,
        bSignificant: p3_b < 0.05,
      },
    },
    indirectEffect: Math.round(indirectEffect * 1000) / 1000,
    proportionMediated: Math.round(proportionMediated * 1000) / 1000,
    sobelTest: {
      z: Math.round(sobelZ * 1000) / 1000,
      p: Math.round(sobelP * 10000) / 10000,
      significant: sobelP < 0.05,
    },
    mediationType,
    description: `Mediasi: ${VAR_LABELS[predictor]} → ${VAR_LABELS[mediator]} → ${VAR_LABELS[outcome]}. ${mediationType}. Efek tidak langsung = ${Math.round(indirectEffect * 1000) / 1000} (Sobel z = ${Math.round(sobelZ * 1000) / 1000}, p = ${sobelP < 0.001 ? "<0.001" : Math.round(sobelP * 10000) / 10000}).`,
  })
}

// OLS solve via normal equations
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
  const rows = a.length
  const cols = b[0].length
  const inner = b.length
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
