import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, verifyPassword, setAdminCookie, clearAdminCookie } from "@/lib/auth"

// POST /api/admin/login { username, password }
export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  const u = await db.adminUser.findUnique({ where: { username: String(username ?? "").trim() } })
  if (!u || !verifyPassword(String(password ?? ""), u.password)) {
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 })
  }
  await setAdminCookie(u.username)
  return NextResponse.json({ ok: true, username: u.username, name: u.name })
}

// DELETE /api/admin/login — logout
export async function DELETE() {
  await clearAdminCookie()
  return NextResponse.json({ ok: true })
}

// Suppress unused import
void hashPassword
