import "server-only";

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
 */

export const ROLES = [
  "tag_exec",
  "tag_csm",
  "tag_sales_manager",
  "tag_sales",
  "client_owner",
  "client_manager",
  "client_closer",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const HAT_LABELS: Record<Role, string> = {
  tag_exec: "Executive",
  tag_csm: "Client services",
  tag_sales_manager: "Sales manager",
  tag_sales: "Sales",
  client_owner: "Client owner",
  client_manager: "Closing manager",
  client_closer: "Closer",
};

export const HAT_DESCRIPTIONS: Record<Role, string> = {
  tag_exec: "Every client, escalation signals, revenue",
  tag_csm: "Assigned clients, onboarding, health",
  tag_sales_manager: "Rep performance across TAG's pipeline",
  tag_sales: "TAG's own pipeline",
  client_owner: "One client's spend, ROAS, and outcomes",
  client_manager: "Closer performance and pipeline health",
  client_closer: "Today's calls, pipeline, notes",
};

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
  client_owner: ["client_owner"],
  client_manager: ["client_manager"],
  client_closer: ["client_closer"],
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
