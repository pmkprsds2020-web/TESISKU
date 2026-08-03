// Server-side helpers: auth, cookies, hashing
import { cookies } from "next/headers"
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

export async function getRespondentCookie(): Promise<string | undefined> {
  const c = await cookies()
  return c.get(RESPONDENT_COOKIE)?.value
}

export async function clearRespondentCookie() {
  const c = await cookies()
  c.delete(RESPONDENT_COOKIE)
}
