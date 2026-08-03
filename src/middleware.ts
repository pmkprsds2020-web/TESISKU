import { NextRequest, NextResponse } from "next/server"

// GUARD: prevent session-cookie loss across hosts.
//
// ROOT CAUSE (confirmed via Vercel logs, Aug 4): every Vercel deployment gets
// its own unique URL (e.g. tesisku-5rzxi5ule-dundet.vercel.app) IN ADDITION
// to the stable production domain (e.g. tesisku.vercel.app or a custom
// domain). Browsers treat these as completely different hosts. The
// `teenmind_code` cookie set on one host is never sent on requests to the
// other host, so a respondent (or tester) who ends up on the per-deployment
// URL after having logged in on the canonical domain gets a hard 401 from
// /api/progress even though their session and answers are intact in the DB.
//
// FIX: on Vercel Production, if the incoming request's host isn't the
// canonical production host, 308-redirect to the canonical host with the
// same path + query + hash-safe behavior, before any cookie is read. This
// makes it impossible to accidentally strand a session on a throwaway
// per-deployment URL — including the URL Vercel shows in the dashboard's
// "Visit" button for a specific deployment.
//
// VERCEL_PROJECT_PRODUCTION_URL is set automatically by Vercel and always
// points at the domain currently assigned as Production (custom domain if
// configured, otherwise the <project>.vercel.app alias). No manual config
// needed; this does nothing on Preview deployments or local dev.
export function middleware(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.next()

  const canonicalHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (!canonicalHost) return NextResponse.next()

  const currentHost = req.headers.get("host")
  if (!currentHost || currentHost === canonicalHost) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.protocol = "https"
  url.host = canonicalHost
  url.port = ""
  return NextResponse.redirect(url, 308)
}

export const config = {
  // Run on everything except static assets/images, so API routes are covered too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
