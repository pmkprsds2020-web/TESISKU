// Server-side helpers: auth, cookies, hashing
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { getOrCreateProjectForIdentity, type Identity } from "@/lib/project"

const ADMIN_COOKIE = "teenmind_admin"
const RESPONDENT_COOKIE = "teenmind_code"

export function hashPassword(pw: string) {
  return createHash("sha256").update(pw + "::teenmind").digest("hex")
}

export function verifyPassword(pw: string, hash: string) {
  return hashPassword(pw) === hash
}

// ─── Admin/researcher identity ─────────────────────────────────────────
//
// The admin cookie used to just hold a plaintext username for the single
// hardcoded admin_users login. It now holds a small JSON identity blob so
// the SAME cookie can represent either:
//   - a legacy admin_users login ({ kind: "legacy", username })
//   - a real Supabase Auth account created via /register or /login
//     ({ kind: "supabase", userId, email })
//
// This keeps every existing API route (`const admin = await getAdminCookie()`)
// working unchanged, while getAdminCookie() now resolves the identity to
// that researcher's own isolated Project and returns its id — so `admin`
// is effectively "projectId of the currently logged-in researcher, or
// undefined if not logged in".

function encodeIdentity(identity: Identity): string {
  return btoa(JSON.stringify({ ...identity, ts: Date.now() }))
}

function decodeIdentity(raw: string): Identity | null {
  try {
    const parsed = JSON.parse(atob(raw))
    if (parsed.kind === "legacy" && typeof parsed.username === "string") {
      return { kind: "legacy", username: parsed.username }
    }
    if (parsed.kind === "supabase" && typeof parsed.userId === "string") {
      return { kind: "supabase", userId: parsed.userId, email: parsed.email ?? null }
    }
    return null
  } catch {
    // Backward compatibility: old cookies were `btoa("username:timestamp")`.
    try {
      const decoded = atob(raw)
      const username = decoded.split(":")[0]
      if (username) return { kind: "legacy", username }
    } catch {
      // ignore
    }
    return null
  }
}

export async function setAdminCookie(identity: Identity) {
  const c = await cookies()
  c.set(ADMIN_COOKIE, encodeIdentity(identity), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  })
}

// Sets the admin cookie directly on a NextResponse via response.cookies.set(),
// instead of the cookies()-from-next/headers pattern above. Functionally
// equivalent for a Route Handler, but keeps the Set-Cookie header tied
// explicitly to the exact response object being returned — use this in
// login routes so there's no ambiguity about which response the cookie
// ends up on.
export function setAdminCookieOnResponse(response: NextResponse, identity: Identity) {
  response.cookies.set(ADMIN_COOKIE, encodeIdentity(identity), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  })
  return response
}

/** Raw identity of the logged-in researcher, or null if not logged in. */
export async function getAdminIdentity(): Promise<Identity | null> {
  const c = await cookies()
  const raw = c.get(ADMIN_COOKIE)?.value
  if (!raw) return null
  return decodeIdentity(raw)
}

/**
 * Resolves the current admin cookie to the researcher's own Project id.
 * Every admin/* API route uses this exact pattern:
 *
 *   const admin = await getAdminCookie()
 *   if (!admin) return unauthorized
 *   ... db.respondent.findMany({ where: { projectId: admin, ... } })
 *
 * so `admin` here IS the tenant-scoping key — not the username.
 */
export async function getAdminCookie(): Promise<string | undefined> {
  const identity = await getAdminIdentity()
  if (!identity) return undefined
  const project = await getOrCreateProjectForIdentity(identity)
  return project.id
}

export async function clearAdminCookie() {
  const c = await cookies()
  c.delete(ADMIN_COOKIE)
}

export async function setRespondentCookie(code: string) {
  const c = await cookies()
  c.set(RESPONDENT_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 3, // 3 days
  })
}

// See setAdminCookieOnResponse — same rationale, for the respondent cookie.
export function setRespondentCookieOnResponse(response: NextResponse, code: string) {
  response.cookies.set(RESPONDENT_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 3, // 3 days
  })
  return response
}

export async function getRespondentCookie(): Promise<string | undefined> {
  const c = await cookies()
  return c.get(RESPONDENT_COOKIE)?.value
}

export async function clearRespondentCookie() {
  const c = await cookies()
  c.delete(RESPONDENT_COOKIE)
}

// ─── Respondent cookie now carries projectId too ───────────────────────
//
// Respondent.code is unique per-project (not globally) now that the app
// is multi-tenant, so the respondent-facing session needs to remember
// which researcher's project it belongs to, not just the bare code. The
// cookie value is `${projectId}::${code}` — still a single opaque string
// from the client's point of view, and `code` shown to the respondent is
// unaffected.
export function encodeRespondentCookieValue(projectId: string, code: string) {
  return `${projectId}::${code}`
}

export function decodeRespondentCookieValue(raw: string): { projectId: string; code: string } | null {
  const idx = raw.indexOf("::")
  if (idx === -1) return null // legacy cookie format (pre-multi-tenant), no project info
  return { projectId: raw.slice(0, idx), code: raw.slice(idx + 2) }
}
