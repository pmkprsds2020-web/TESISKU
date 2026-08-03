import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PERF: 'query' logging prints every single SQL statement to stdout.
// In production this adds real I/O + serialization overhead to EVERY
// request (and floods logs), which is a big part of why every page/action
// feels sluggish. Only log queries in development; keep warnings/errors
// always on so real problems are still visible in production.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ─── Connection-pool exhaustion resilience ────────────────────────────
//
// INCIDENT (Aug 2): Vercel logs showed intermittent 500s with
// `FATAL: (EMAXCONNSESSION) max clie...` from Supabase's connection
// pooler (Supavisor). This is NOT an application bug — it means the
// number of concurrent Postgres sessions from this app's serverless
// functions exceeded what the pooler allows. On Vercel, every API route
// can be its own serverless function, and every concurrent invocation
// (auto-scaled under load, e.g. many respondents submitting at once) may
// spin up its own PrismaClient connection pool. That adds up fast against
// a pooler's session cap.
//
// The real fix lives in configuration, not code — DATABASE_URL should
// point at Supabase's **Transaction**-mode pooler (port 6543, not the
// direct/session port 5432) with a low per-client connection limit, e.g.:
//
//   DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10"
//   DIRECT_URL="postgresql://...:5432/postgres"   // only used by prisma migrate/db push
//
// This lets many short-lived serverless invocations share the pooler's
// connections instead of each one holding several of its own. See
// .env.example.
//
// As a backstop for whatever residual contention still happens under
// bursty load, `withDbRetry` retries a DB operation once, after a short
// backoff, specifically for errors that look like transient connection/
// pool exhaustion (not for real query errors, which fail immediately as
// before).
export function isTransientConnectionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /EMAXCONNSESSION|Connection pool timeout|Can't reach database server|Timed out fetching a new connection|P1001|P1017|P2024/i.test(msg)
}

// Bumped from 1→2 retries (Aug 4 incident: sustained concurrent load from
// many respondents saving at once kept exhausting the single retry too).
// Backoff stays short since Route Handlers have their own execution time
// limits — this is meant to smooth over brief queueing, not long outages.
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (retries > 0 && isTransientConnectionError(e)) {
      await new Promise((r) => setTimeout(r, delayMs))
      return withDbRetry(fn, retries - 1, delayMs * 2)
    }
    throw e
  }
}