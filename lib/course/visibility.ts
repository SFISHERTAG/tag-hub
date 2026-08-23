import { ROLES, type Role } from "@/lib/auth/role-labels";

/**
 * Who can see a course, and who can see one lesson inside it.
 *
 * Two rules, both deliberate:
 *
 * An empty allowlist means everyone signed in. Training was open to every
 * session before story 12.4, and a migration that silently reinterpreted
 * "unset" as "nobody" would have removed access to the onboarding course from
 * every client on the day it ran. This is the opposite of the field-catalog
 * defect the resweep found, where six roles fell through to `?? "never"` and
 * were denied everything with no way to tell.
 *
 * Admins are never locked out. Someone has to be able to open a course to fix
 * it, and an admin who cannot see the thing they administer files a bug
 * against the course rather than the permission.
 *
 * Imports from role-labels.ts rather than roles.ts on purpose: roles.ts is
 * `server-only` because it also carries the hat-cookie logic, and this module
 * is reached by the import script, which runs in plain node.
 */
export function canSeeCourse(
  role: Role | undefined,
  visibleToRoles: readonly string[],
): boolean {
  if (visibleToRoles.length === 0) return true;
  if (role === ROLES.ADMIN) return true;
  return visibleToRoles.some((allowed) => role === allowed);
}

/** Same rule, applied to one lesson. A lesson inherits nothing; it states its own. */
export const canSeeSubsection = canSeeCourse;

/**
 * The audiences story 12.4 imports against, named once.
 *
 * These are hats, not a hierarchy: a CS Director sees the CSM course because
 * they run that department, not because roles nest. `lib/auth/roles.ts` has no
 * seniority ordering and this file does not invent one.
 */
export const COURSE_AUDIENCES = {
  /** Internal client-services training. */
  CSM: [ROLES.TAG_CSM, ROLES.TAG_CSD, ROLES.TAG_EXEC] as readonly Role[],

  /** Internal sales training, including recordings of real client calls. */
  SALES_REP: [ROLES.TAG_SALES, ROLES.TAG_SALES_MANAGER, ROLES.TAG_EXEC] as readonly Role[],

  /**
   * Client-facing. Left empty on purpose: these two courses are the ones every
   * signed-in user could already see, and narrowing them is not this story.
   */
  EVERYONE: [] as readonly Role[],
} as const;
