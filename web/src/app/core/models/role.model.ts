/**
 * Port of lib/auth/role-labels.ts. This is the client-side mirror of the single
 * source of truth in that file, not an independent definition (see CLAUDE.md's
 * permission-model contract). scripts/check-role-parity.mjs fails the commit if
 * the two drift.
 *
 * Keyed rather than a bare array so `ROLES.ADMIN` has a referent and a typo is a
 * compile error. `ROLE_LIST` is for the few call sites that genuinely iterate.
 */
export const ROLES = {
  ADMIN: 'admin',
  TAG_EXEC: 'tag_exec',
  TAG_CSD: 'tag_csd',
  TAG_CSM: 'tag_csm',
  TAG_SALES_MANAGER: 'tag_sales_manager',
  TAG_SALES: 'tag_sales',
  TAG_SETTER_MANAGER: 'tag_setter_manager',
  TAG_SETTER: 'tag_setter',
  CLIENT_OWNER: 'client_owner',
  CLIENT_MANAGER: 'client_manager',
  CLIENT_CLOSER: 'client_closer',
  CLIENT_SETTER_MANAGER: 'client_setter_manager',
  CLIENT_SETTER: 'client_setter',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LIST: readonly Role[] = Object.values(ROLES);

export const HAT_LABELS: Record<Role, string> = {
  admin: 'Hub admin',
  tag_exec: 'Executive',
  tag_csd: 'CS Director',
  tag_csm: 'Client services',
  tag_sales_manager: 'Sales manager',
  tag_sales: 'Sales',
  tag_setter_manager: 'Setter manager',
  tag_setter: 'Setter',
  client_owner: 'Client owner',
  client_manager: 'Closing manager',
  client_closer: 'Closer',
  client_setter_manager: 'Setter manager',
  client_setter: 'Setter',
};

export const HAT_DESCRIPTIONS: Record<Role, string> = {
  admin: 'User management, roles, and Hub infrastructure',
  tag_exec: 'Every client, escalation signals, revenue',
  tag_csd: "Whole CS department: every CSM's book, workload, and risk",
  tag_csm: 'Assigned clients, onboarding, health',
  tag_sales_manager: "Rep and setter performance across TAG's pipeline",
  tag_sales: "TAG's own pipeline",
  tag_setter_manager: 'Setter speed and volume metrics',
  tag_setter: 'Today\'s leads, callbacks, speed to contact',
  client_owner: 'One client\'s spend, ROAS, and outcomes',
  client_manager: 'Closer performance and pipeline health',
  client_closer: "Today's calls, pipeline, notes",
  client_setter_manager: 'Setter speed and volume metrics',
  client_setter: "Today's leads, callbacks, speed to contact",
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_LIST as readonly string[]).includes(value);
}

/**
 * The roles whose reach is every location, regardless of their grant.
 *
 * Story 15.A. Mirrors `GLOBAL_ROLES` in `lib/auth/grants.ts` and the two must
 * change together: a divergence shows a screen the API will refuse, or hides
 * one it would have served. The server is authoritative — this exists so the
 * guard can avoid a round trip, never to make the decision.
 *
 * The plan counted three inline copies of this triple and there were four; this
 * was the one it missed, because it looked for them server-side.
 */
export const GLOBAL_ROLES: readonly Role[] = [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.ADMIN];

/** True when the role reaches every location. */
export function isGlobalRole(role: string): boolean {
  return (GLOBAL_ROLES as readonly string[]).includes(role);
}
