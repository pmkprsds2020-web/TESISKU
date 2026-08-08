import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAdminCookie } from "@/lib/auth"
import { climateScoreFromBullyingRelation } from "@/lib/scoring"

// POST /api/admin/cluster
// Body: { variables: string[], k: number }
// Returns: k-means cluster assignments, centroids, cluster profiles
export async function POST(req: NextRequest) {
  const admin = await getAdminCookie()
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { variables, k: kInput } = await req.json()
  const validVars = ["cesdr", "psqi", "mos", "bullying", "climate", "religiosity"]
  if (!Array.isArray(variables) || variables.length < 2) {
    return NextResponse.json({ error: "Minimal 2 variabel diperlukan" }, { status: 400 })
  }
  const cleanVars = variables.filter((v: string) => validVars.includes(v))
  if (cleanVars.length < 2) {
    return NextResponse.json({ error: "Variabel tidak valid" }, { status: 400 })
  }

  const k = Math.min(Math.max(Number(kInput) || 3, 2), 5)

  const respondents = await db.respondent.findMany({
    where: { projectId: admin, status: "completed" },
    include: {
      cesdr: true,
      psqi: true,
      mos: true,
      bullying: true,
      religiosity: true,
      demographic: true,
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
      default: return null
    }
  }

  const data: { code: string; values: number[] }[] = []
  for (const r of respondents) {
    const vals = cleanVars.map((v: string) => getScore(r, v))
    if (vals.some(v => v === null)) continue
    data.push({ code: r.code, values: vals as number[] })
  }

  if (data.length < k + 1) {
    return NextResponse.json({ error: `Data tidak cukup (${data.length}, minimal ${k + 1})` })
  }

  const n = data.length
  const numVars = cleanVars.length

  // Standardize (z-scores) for fair clustering
  const means: number[] = []
  const sds: number[] = []
  for (let j = 0; j < numVars; j++) {
    const col = data.map(d => d.values[j])
    const mean = col.reduce((a, b) => a + b, 0) / n
    const sd = Math.sqrt(col.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1))
    means.push(mean)
    sds.push(sd || 1)
  }

  const standardized = data.map(d => d.values.map((v, j) => (v - means[j]) / sds[j]))

  // K-means++ initialization
  const centroids: number[][] = []
  // First centroid: random
  centroids.push([...standardized[Math.floor(Math.random() * n)]])
  // Subsequent: proportional to distance squared
  for (let c = 1; c < k; c++) {
    const distances = standardized.map(point => {
      let minDist = Infinity
      for (const centroid of centroids) {
        let dist = 0
        for (let j = 0; j < numVars; j++) {
          dist += (point[j] - centroid[j]) ** 2
        }
        if (dist < minDist) minDist = dist
      }
      return minDist
    })
    const totalDist = distances.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalDist
    let idx = 0
    for (let i = 0; i < n; i++) {
      r -= distances[i]
      if (r <= 0) { idx = i; break }
    }
    centroids.push([...standardized[idx]])
  }

  // K-means iterations
  const maxIter = 100
  let assignments = new Array(n).fill(0)
  let converged = false

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = standardized.map(point => {
      let minDist = Infinity
      let bestCluster = 0
      for (let c = 0; c < k; c++) {
        let dist = 0
        for (let j = 0; j < numVars; j++) {
          dist += (point[j] - centroids[c][j]) ** 2
        }
        if (dist < minDist) {
          minDist = dist
          bestCluster = c
        }
      }
      return bestCluster
    })

    // Check convergence
    if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) {
      converged = true
      break
    }
    assignments = newAssignments

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = standardized.filter((_, i) => assignments[i] === c)
      if (members.length === 0) continue
      for (let j = 0; j < numVars; j++) {
        centroids[c][j] = members.reduce((sum, m) => sum + m[j], 0) / members.length
      }
    }
  }

  // Compute cluster profiles (back to raw scores)
  const clusterProfiles: { cluster: number; n: number; means: Record<string, number>; codes: string[] }[] = []
  for (let c = 0; c < k; c++) {
    const members = data.filter((_, i) => assignments[i] === c)
    const clusterMeans: Record<string, number> = {}
    for (let j = 0; j < numVars; j++) {
      const vals = members.map(m => m.values[j])
      clusterMeans[cleanVars[j]] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0
    }
    clusterProfiles.push({
      cluster: c + 1,
      n: members.length,
      means: clusterMeans,
      codes: members.map(m => m.code),
    })
  }

  // Compute within-cluster sum of squares (WCSS) for elbow method
  let wcss = 0
  for (let i = 0; i < n; i++) {
    const c = assignments[i]
    for (let j = 0; j < numVars; j++) {
      wcss += (standardized[i][j] - centroids[c][j]) ** 2
    }
  }

  // Total sum of squares
  let tss = 0
  const grandMean = new Array(numVars).fill(0)
  for (let j = 0; j < numVars; j++) {
    grandMean[j] = standardized.reduce((sum, point) => sum + point[j], 0) / n
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < numVars; j++) {
      tss += (standardized[i][j] - grandMean[j]) ** 2
    }
  }

  // R² equivalent (between-cluster SS / total SS)
  const rSquared = tss > 0 ? 1 - wcss / tss : 0

  // Assignments with codes
  const memberAssignments = data.map((d, i) => ({
    code: d.code,
    cluster: assignments[i] + 1,
    values: d.values.reduce((obj, v, j) => {
      obj[cleanVars[j]] = v
      return obj
    }, {} as Record<string, number>),
  }))

  // Centroids in raw score space (for visualization)
  const rawCentroids = centroids.map((c) => {
    const obj: Record<string, number> = {}
    for (let j = 0; j < numVars; j++) {
      obj[cleanVars[j]] = Math.round((c[j] * sds[j] + means[j]) * 100) / 100
    }
    return obj
  })

  const VAR_LABELS: Record<string, string> = {
    cesdr: "CESD-R",
    psqi: "PSQI",
    mos: "MOS",
    bullying: "Bullying (GBS)",
    climate: "Climate School",
    religiosity: "Religiusitas",
  }

  // Generate cluster labels based on profiles
  const clusterLabels = clusterProfiles.map(profile => {
    const m = profile.means
    const cesdr = m["cesdr"] ?? 0
    const psqi = m["psqi"] ?? 0
    const mos = m["mos"] ?? 0
    const bullying = m["bullying"] ?? 0
    const relig = m["religiosity"] ?? 0

    if (cesdr >= 20 && psqi >= 8) return "Rentan Depresi"
    if (cesdr <= 10 && mos >= 25 && relig >= 30) return "Sehat Mental"
    // NOTE (perbaikan): threshold ini dulu 8 dari saat "bullying" masih
    // gabungan GBS+Climate School (range 0-24, jadi 8 ≈ 33%). Sekarang
    // "bullying" = GBS saja (range 0-12, lihat SCORE_RANGES.gbs di
    // src/lib/instruments.ts) sehingga threshold disesuaikan ke 5 (cutoff
    // "sedang-berat" yang sama dipakai interpretGBS() di interpretation.ts).
    if (bullying >= 5 && cesdr >= 15) return "Korban Bullying"
    if (mos <= 20 && cesdr >= 15) return "Kurang Dukungan"
    if (relig >= 30 && cesdr <= 15) return "Religius Sehat"
    return `Klaster ${profile.cluster}`
  })

  return NextResponse.json({
    variables: cleanVars,
    variableLabels: cleanVars.map((v: string) => VAR_LABELS[v] || v),
    k,
    n,
    converged,
    wcss: Math.round(wcss * 1000) / 1000,
    rSquared: Math.round(rSquared * 1000) / 1000,
    iterations: maxIter,
    clusters: clusterProfiles.map((p, i) => ({
      ...p,
      label: clusterLabels[i],
    })),
    centroids: rawCentroids,
    assignments: memberAssignments,
    description: `K-means clustering dengan k=${k} mengelompokkan ${n} responden menjadi ${k} klaster. R² = ${Math.round(rSquared * 1000) / 1000} (${Math.round(rSquared * 100)}% varians dijelaskan oleh klaster).`,
  })
}
