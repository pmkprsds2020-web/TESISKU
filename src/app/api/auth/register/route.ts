import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { setAdminCookieOnResponse } from "@/lib/auth"

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

// POST /api/auth/register
// { fullName, institution, email, username, password, confirmPassword,
//   researchTitle, projectName, targetRespondents, phone }
//
// 1. Creates the account in Supabase Auth (auth.users) — this is the
//    account of record; password hashing/storage is entirely Supabase's.
// 2. Creates a brand new, completely empty Project owned by that user.
//    No data is ever copied from any other account.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fullName = String(body.fullName ?? "").trim()
    const institution = String(body.institution ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const username = String(body.username ?? "").trim()
    const password = String(body.password ?? "")
    const confirmPassword = String(body.confirmPassword ?? "")
    const researchTitle = String(body.researchTitle ?? "").trim()
    const projectName = String(body.projectName ?? "").trim() || researchTitle || "Project Baru"
    const targetRespondents = Number(body.targetRespondents) || 100
    const phone = String(body.phone ?? "").trim()
    const agreed = Boolean(body.agreed)

    if (!fullName || !email || !username || !password) {
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 })
    }
    if (!agreed) {
      return NextResponse.json({ error: "Anda harus menyetujui syarat dan ketentuan." }, { status: 400 })
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Password dan konfirmasi password tidak sama." }, { status: 400 })
    }
    if (!PASSWORD_RULE.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, angka, dan karakter spesial.",
        },
        { status: 400 }
      )
    }

    const existingUsername = await db.project.findUnique({ where: { username } })
    if (existingUsername) {
      return NextResponse.json({ error: "Username sudah digunakan." }, { status: 409 })
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, username, institution } },
    })

    if (error) {
      // Supabase reports duplicate emails this way
      const msg = /already registered|already exists|already in use/i.test(error.message)
        ? "Email sudah terdaftar."
        : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (!data.user) {
      return NextResponse.json({ error: "Gagal membuat akun." }, { status: 500 })
    }

    // Brand new, empty workspace — never linked to any other account's data.
    const project = await db.project.create({
      data: {
        ownerId: data.user.id,
        ownerEmail: email,
        ownerName: fullName,
        username,
        name: projectName,
        researchTitle: researchTitle || null,
        institution: institution || null,
        phone: phone || null,
        targetRespondents,
      },
    })

    await db.auditLog.create({
      data: { projectId: project.id, action: "register", detail: `Registrasi akun peneliti (${email})` },
    })

    // If email confirmation is required by the Supabase project settings,
    // there will be no session yet — tell the client to show a
    // "check your email" screen instead of logging straight in.
    if (!data.session) {
      return NextResponse.json({ ok: true, requiresEmailConfirmation: true })
    }

    const response = NextResponse.json({ ok: true, requiresEmailConfirmation: false })
    setAdminCookieOnResponse(response, { kind: "supabase", userId: data.user.id, email })
    return response
  } catch (e) {
    console.error("[auth/register]", e)
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
  }
}
