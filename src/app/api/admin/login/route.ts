import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, verifyPassword, setAdminCookieOnResponse, clearAdminCookie } from "@/lib/auth"

// POST /api/admin/login { username, password }
// Legacy login path — kept for backward compatibility with the original
// single hardcoded admin_users account. New researchers should register
// via /register (Supabase Auth) instead; see /api/auth/*.
export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  const u = await db.adminUser.findUnique({ where: { username: String(username ?? "").trim() } })
  if (!u || !verifyPassword(String(password ?? ""), u.password)) {
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 })
  }
  const response = NextResponse.json({ ok: true, username: u.username, name: u.name })
  setAdminCookieOnResponse(response, { kind: "legacy", username: u.username })
  return response
}

// DELETE /api/admin/login — logout
export async function DELETE() {
  await clearAdminCookie()
  return NextResponse.json({ ok: true })
}

// Suppress unused import
void hashPassword
