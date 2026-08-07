import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { clearAdminCookie } from "@/lib/auth"

export async function POST() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  await clearAdminCookie()
  return NextResponse.json({ ok: true })
}
