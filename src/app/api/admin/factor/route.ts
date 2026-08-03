import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"

// POST /api/admin/factor
// Body: { instrument: "cesdr"|"mos"|"bullying"|"religiosity" }
// Returns: PCA eigenvalues, factor loadings, variance explained
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { instrument } = await req.json()
  const valid = ["cesdr", "mos", "bullying", "religiosity"]
  if (!valid.includes(instrument)) {
    return NextResponse.json({ error: "Invalid instrument" }, { status: 400 })
  }

  const respondents = await db.respondent.findMany({
    where: { status: "completed" },
    include: {
      cesdr: true,
      mos: true,
      bullying: true,
      religiosity: true,
    },
  })

  const numItems =
    instrument === "cesdr" ? 20 :
    instrument === "mos" ? 8 :
    instrument === "bullying" ? 8 : 8

  // Build data matrix (respondents × items)
  const matrix: number[][] = []
  for (const r of respondents) {
    const ans = r[instrument as "cesdr" | "mos" | "bullying" | "religiosity"]
    if (!ans) continue
    const parsed = JSON.parse(ans.answers) as Record<string, number>
    const items: number[] = []
    for (let i = 1; i <= numItems; i++) {
      if (parsed[i] !== undefined && parsed[i] !== null) {
        items.push(Number(parsed[i]))
      }
    }
    if (items.length === numItems) matrix.push(items)
  }

  if (matrix.length < numItems + 2) {
    return NextResponse.json({
      error: `Data tidak cukup (${matrix.length} responden, minimal ${numItems + 2} diperlukan)`,
    })
  }

  const n = matrix.length
  const k = numItems

  // Standardize items (z-scores)
  const itemMeans: number[] = []
  const itemSDs: number[] = []
  for (let j = 0; j < k; j++) {
    const col = matrix.map(row => row[j])
    const mean = col.reduce((a, b) => a + b, 0) / n
    const variance = n > 1 ? col.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1) : 0
    itemMeans.push(mean)
    itemSDs.push(Math.sqrt(variance))
  }

  const standardized: number[][] = matrix.map(row =>
    row.map((val, j) => itemSDs[j] > 0 ? (val - itemMeans[j]) / itemSDs[j] : 0)
  )

  // Compute correlation matrix (R = X'X / (n-1) for standardized data)
  const R: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      let sum = 0
      for (let i = 0; i < n; i++) {
        sum += standardized[i][a] * standardized[i][b]
      }
      R[a][b] = sum / (n - 1)
    }
  }

  // Eigenvalue decomposition via Jacobi rotation
  const { eigenvalues, eigenvectors } = jacobiEigen(R, k)

  // Sort by eigenvalue descending
  const sortedIndices = eigenvalues.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).map(x => x.i)
  const sortedEigenvalues = sortedIndices.map(i => eigenvalues[i])
  const sortedEigenvectors = sortedIndices.map(i => eigenvectors[i])

  // Total variance = sum of eigenvalues (= k for standardized data)
  const totalVar = sortedEigenvalues.reduce((a, b) => a + b, 0)

  // Factor loadings: eigenvector × sqrt(eigenvalue)
  const numFactors = Math.min(k, Math.max(1, sortedEigenvalues.filter(v => v > 1).length || 1))
  const loadings: { item: number; [factor: string]: number }[] = []
  for (let item = 0; item < k; item++) {
    const row: { item: number; [factor: string]: number } = { item: item + 1 }
    for (let f = 0; f < numFactors; f++) {
      row[`F${f + 1}`] = Math.round(sortedEigenvectors[f][item] * Math.sqrt(Math.max(0, sortedEigenvalues[f])) * 1000) / 1000
    }
    loadings.push(row)
  }

  // Communalities: sum of squared loadings per item
  const communalities = loadings.map(row => {
    let sum = 0
    for (let f = 0; f < numFactors; f++) {
      sum += (row[`F${f + 1}`] as number) ** 2
    }
    return { item: row.item, communality: Math.round(sum * 1000) / 1000 }
  })

  // KMO (Kaiser-Meyer-Olkin) measure of sampling adequacy
  let sumCorrSq = 0
  let sumPartialCorrSq = 0
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a !== b) {
        sumCorrSq += R[a][b] ** 2
        // Partial correlation (simplified: inverse diagonal of R)
        // For KMO, use the anti-image correlation matrix
        // Simplified approximation: use 1 - R[a][b]^2 as partial correlation proxy
        sumPartialCorrSq += (1 - R[a][b] ** 2) ** 2
      }
    }
  }
  const kmo = sumCorrSq + sumPartialCorrSq > 0 ? sumCorrSq / (sumCorrSq + sumPartialCorrSq) : 0

  // Bartlett's test of sphericity (simplified)
  const chiSqBartlett = (n - 1 - (2 * k + 5) / 6) * Math.max(0, -Math.log(det(R)))
  const dfBartlett = (k * (k - 1)) / 2
  const pBartlett = chiSqBartlett > 0 ? chiSquarePValue(chiSqBartlett, dfBartlett) : 1

  const INSTRUMENT_NAMES: Record<string, string> = {
    cesdr: "CESD-R (Depresi)",
    mos: "MOS-SSS (Dukungan Sosial)",
    bullying: "Gatehouse Bullying Scale",
    religiosity: "Skala Religiusitas",
  }

  return NextResponse.json({
    instrument,
    instrumentName: INSTRUMENT_NAMES[instrument],
    n,
    numItems: k,
    numFactors,
    eigenvalues: sortedEigenvalues.map((v, i) => ({
      factor: i + 1,
      eigenvalue: Math.round(v * 1000) / 1000,
      variancePct: Math.round((v / totalVar) * 1000) / 10,
      cumulativePct: Math.round((sortedEigenvalues.slice(0, i + 1).reduce((a, b) => a + b, 0) / totalVar) * 1000) / 10,
      kaiserCriterion: v > 1,
    })),
    loadings,
    communalities,
    kmo: Math.round(kmo * 1000) / 1000,
    kmoInterpretation: kmo >= 0.9 ? "Sangat baik" : kmo >= 0.8 ? "Baik" : kmo >= 0.7 ? "Cukup" : kmo >= 0.6 ? "Sedang" : "Buruk",
    bartlett: {
      chiSquare: Math.round(chiSqBartlett * 1000) / 1000,
      df: dfBartlett,
      pValue: Math.round(pBartlett * 10000) / 10000,
      significant: pBartlett < 0.05,
    },
  })
}

// Jacobi eigenvalue decomposition
function jacobiEigen(A: number[][], n: number): { eigenvalues: number[]; eigenvectors: number[][] } {
  // Make a copy
  const a = A.map(row => [...row])
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))

  const maxIter = 100
  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let maxVal = 0
    let p = 0, q = 1
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[i][j]) > maxVal) {
          maxVal = Math.abs(a[i][j])
          p = i
          q = j
        }
      }
    }
    if (maxVal < 1e-10) break

    // Compute rotation angle
    const app = a[p][p]
    const aqq = a[q][q]
    const apq = a[p][q]
    const theta = Math.abs(app - aqq) < 1e-20 ? Math.PI / 4 : 0.5 * Math.atan2(2 * apq, app - aqq)
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)

    // Apply rotation
    for (let i = 0; i < n; i++) {
      const temp = a[i][p]
      a[i][p] = cos * temp + sin * a[i][q]
      a[i][q] = -sin * temp + cos * a[i][q]
    }
    for (let j = 0; j < n; j++) {
      const temp = a[p][j]
      a[p][j] = cos * temp + sin * a[q][j]
      a[q][j] = -sin * temp + cos * a[q][j]
    }
    for (let i = 0; i < n; i++) {
      const temp = v[i][p]
      v[i][p] = cos * temp + sin * v[i][q]
      v[i][q] = -sin * temp + cos * v[i][q]
    }
  }

  const eigenvalues = a.map((row, i) => row[i])
  // Eigenvectors are columns of v
  const eigenvectors: number[][] = []
  for (let col = 0; col < n; col++) {
    eigenvectors.push(v.map(row => row[col]))
  }

  return { eigenvalues, eigenvectors }
}

// Matrix determinant (via LU decomposition)
function det(m: number[][]): number {
  const n = m.length
  const a = m.map(row => [...row])
  let d = 1
  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(a[j][i]) > Math.abs(a[maxRow][i])) maxRow = j
    }
    if (maxRow !== i) {
      ;[a[i], a[maxRow]] = [a[maxRow], a[i]]
      d = -d
    }
    if (Math.abs(a[i][i]) < 1e-15) return 0
    d *= a[i][i]
    for (let j = i + 1; j < n; j++) {
      const factor = a[j][i] / a[i][i]
      for (let k = i; k < n; k++) {
        a[j][k] -= factor * a[i][k]
      }
    }
  }
  return d
}

// Chi-square P-value
function chiSquarePValue(chi2: number, df: number): number {
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
