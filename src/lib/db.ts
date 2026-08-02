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