// Multi-tenant project resolution.
//
// Every researcher (whether they log in via the legacy admin_users table
// or via a new Supabase-Auth-based account created on /register) is
// mapped to exactly one Project row. Every piece of research data
// (respondents, research codes, audit logs, settings) is scoped by
// projectId, so two accounts can never see each other's data — a brand
// new account always starts at 0 respondents / 0 codes / 0 analytics.
import { db } from "@/lib/db"

export type Identity =
  | { kind: "legacy"; username: string }
  | { kind: "supabase"; userId: string; email?: string | null }

/**
 * Returns (creating if necessary) the Project that belongs to this
 * identity. Legacy admin accounts all share the single pre-existing
 * "Legacy / Default" project (see prisma/migration-multitenant.sql) so
 * that data created before this feature existed is never lost or
 * orphaned. New Supabase accounts always get their own brand-new,
 * completely empty project.
 */
export async function getOrCreateProjectForIdentity(identity: Identity) {
  if (identity.kind === "legacy") {
    const ownerId = `legacy:${identity.username}`
    let project = await db.project.findUnique({ where: { ownerId } })
    if (!project) {
      // Should already exist from the SQL migration, but create on the
      // fly as a safety net (e.g. a second legacy admin_users row).
      project = await db.project.create({
        data: { ownerId, name: "Legacy / Default", targetRespondents: 100 },
      })
    }
    return project
  }

  let project = await db.project.findUnique({ where: { ownerId: identity.userId } })
  if (!project) {
    // Defensive fallback: normally created synchronously inside
    // /api/auth/register right after supabase.auth.signUp() succeeds.
    project = await db.project.create({
      data: {
        ownerId: identity.userId,
        ownerEmail: identity.email ?? null,
        name: "Project Baru",
        targetRespondents: 100,
      },
    })
  }
  return project
}

export async function getProjectByOwnerId(ownerId: string) {
  return db.project.findUnique({ where: { ownerId } })
}
