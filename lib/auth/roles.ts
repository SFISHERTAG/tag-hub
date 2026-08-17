import "server-only";
import { ROLES, HAT_LABELS, HAT_DESCRIPTIONS, type Role } from "./role-labels";

/**
 * Roles and hats.
 *
 * A **role** is the permission ceiling, set by TAG on the user's custom claims.
 * A **hat** is the view currently being worn, chosen by the user and stored in a
 * cookie.
 *
 * They are deliberately separate. A hat changes which interface renders; it
 * never changes which data is reachable. Tenant access is governed by the
 * `locations` claim and checked before every GHL call, so putting on the
 * `client_owner` hat shows that dashboard for tenants you could already see —
 * it does not unlock one you could not. Without that line, "choose your hat"
 * becomes "choose your permissions".
 *
 * TAG is three people and a sales team, so all three founders hold `tag_exec`
 * and may wear anything. Sales reps hold `tag_sales` and wear one hat, because
 * a rep switching into an executive view is a permissions question, not a
 * convenience one.
 *
 * `ROLES` / `Role` / `HAT_LABELS` / `HAT_DESCRIPTIONS` live in role-labels.ts
 * and are re-exported here — that file has no `server-only` marker because
 * it is pure display data, safe in client bundles, and admin UI needs it
 * there to render a role dropdown. Everything below that actually trusts a
 * hat cookie stays here, server-only.
 */

export { ROLES, HAT_LABELS, HAT_DESCRIPTIONS, type Role };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Validate that a requested role is in the available list.
 * Returns the requested role if valid, otherwise returns the first available.
 * Falls back rather than throwing — a stale cookie after a role change should
 * degrade to the correct role, not to an error page.
 */
export function effectiveRole(
  availableRoles: readonly Role[],
  requested: string | undefined,
): Role {
  if (isRole(requested) && availableRoles.includes(requested)) return requested;
  return availableRoles[0] ?? "client_closer";
}
