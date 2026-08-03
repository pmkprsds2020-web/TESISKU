// Server-side helpers: auth, cookies, hashing
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createHash } from "crypto"

const ADMIN_COOKIE = "teenmind_admin"
const RESPONDENT_COOKIE = "teenmind_code"

export function hashPassword(pw: string) {
  return createHash("sha256").update(pw + "::teenmind").digest("hex")
}

export function verifyPassword(pw: string, hash: string) {
  return hashPassword(pw) === hash
}

export async function setAdminCookie(username: string) {
  const c = await cookies()
  c.set(ADMIN_COOKIE, btoa(`${username}:${Date.now()}`), {
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
export function setAdminCookieOnResponse(response: NextResponse, username: string) {
  response.cookies.set(ADMIN_COOKIE, btoa(`${username}:${Date.now()}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  })
  return response
}

export async function getAdminCookie(): Promise<string | undefined> {
  const c = await cookies()
  return c.get(ADMIN_COOKIE)?.value
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
