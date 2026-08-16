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
 * Hats a role may wear.
 *
 * Only `tag_exec` wears more than one. That is the founder role, and today TAG
 * is three founders and a sales team — the three need every view, and nobody
 * else does.
 *
 * Clients and sales reps get exactly one hat, so the switcher never renders for
 * them. A rep who could put on an executive hat would be a permissions change
 * dressed as a convenience, and a client seeing a view chooser at all would
 * reveal that other views exist.
 */
const WEARABLE: Record<Role, readonly Role[]> = {
  tag_exec: ROLES,
  tag_csm: ["tag_csm"],
  tag_sales_manager: ["tag_sales_manager"],
  tag_sales: ["tag_sales"],
  tag_setter_manager: ["tag_setter_manager"],
  tag_setter: ["tag_setter"],
  client_owner: ["client_owner"],
  client_manager: ["client_manager"],
  client_closer: ["client_closer"],
  client_setter_manager: ["client_setter_manager"],
  client_setter: ["client_setter"],
};

export function wearableHats(role: Role): readonly Role[] {
  return WEARABLE[role] ?? [role];
}

export function canWear(role: Role, hat: Role): boolean {
  return wearableHats(role).includes(hat);
}

/**
 * The hat in effect: the requested one when permitted, otherwise the role's own.
 * Falls back rather than throwing — a stale cookie after a role change should
 * degrade to the correct view, not to an error page.
 */
export function effectiveHat(role: Role, requested: string | undefined): Role {
  if (isRole(requested) && canWear(role, requested)) return requested;
  return role;
}
