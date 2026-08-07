import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

// POST /api/auth/change-password { email, oldPassword, newPassword, confirmPassword }
// Requires a live Supabase session (the researcher must already be logged
// in via Supabase Auth — legacy admin_users accounts should use the old
// admin password flow, unaffected by this route).
export async function POST(req: NextRequest) {
  try {
    const { email, oldPassword, newPassword, confirmPassword } = await req.json()

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 })
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Konfirmasi password baru tidak sama." }, { status: 400 })
    }
    if (newPassword === oldPassword) {
      return NextResponse.json({ error: "Password baru harus berbeda dari password lama." }, { status: 400 })
    }
    if (!PASSWORD_RULE.test(newPassword)) {
      return NextResponse.json(
        { error: "Password baru harus minimal 8 karakter, mengandung huruf besar, huruf kecil, angka, dan karakter spesial." },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // Verify the current password is correct by re-authenticating.
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: String(email ?? "").trim().toLowerCase(),
      password: oldPassword,
    })
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Password lama salah." }, { status: 401 })
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[auth/change-password]", e)
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
  }
}
