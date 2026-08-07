import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { setAdminCookieOnResponse } from "@/lib/auth"

// POST /api/auth/login { email, password }
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const clean = String(email ?? "").trim().toLowerCase()
    if (!clean || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: clean, password })

    if (error || !data.user) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    setAdminCookieOnResponse(response, { kind: "supabase", userId: data.user.id, email: clean })
    return response
  } catch (e) {
    console.error("[auth/login]", e)
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
  }
}
