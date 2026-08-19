/**
 * Role identifiers and their display labels.
 *
 * Split out from roles.ts deliberately — that file is `server-only` because
 * it also carries the logic that trusts a hat cookie (`effectiveRole`,
 * and the `availableRoles` check in `wearHat`), which has no business
 * running in the browser. This file is
 * just names and copy: nothing here is sensitive, and admin UI that renders
 * a role dropdown needs it client-side to build one. roles.ts re-exports
 * everything here, so every existing server-side import of `ROLES` / `ROLE_LIST` /
 * `HAT_LABELS` from "./roles" keeps working unchanged.
 */

/**
 * Keyed rather than a bare array so CLAUDE.md's permission contract is
 * actually writable: `ROLES.ADMIN` has a referent, and a typo in a role name
 * is a compile error instead of a string that silently matches nothing. This
 * is the shape the "tag_admin" vs "admin" mismatch in the August audit needed.
 * `ROLE_LIST` is for the handful of call sites that genuinely iterate (admin
 * role dropdowns); prefer `ROLES.*` everywhere else.
 */
export const ROLES = {
  ADMIN: "admin",
  TAG_EXEC: "tag_exec",
  TAG_CSD: "tag_csd",
  TAG_CSM: "tag_csm",
  TAG_SALES_MANAGER: "tag_sales_manager",
  TAG_SALES: "tag_sales",
  TAG_SETTER_MANAGER: "tag_setter_manager",
  TAG_SETTER: "tag_setter",
  CLIENT_OWNER: "client_owner",
  CLIENT_MANAGER: "client_manager",
  CLIENT_CLOSER: "client_closer",
  CLIENT_SETTER_MANAGER: "client_setter_manager",
  CLIENT_SETTER: "client_setter",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LIST: readonly Role[] = Object.values(ROLES);

export const HAT_LABELS: Record<Role, string> = {
  admin: "Hub admin",
  tag_exec: "Executive",
  tag_csd: "CS Director",
  tag_csm: "Client services",
  tag_sales_manager: "Sales manager",
  tag_sales: "Sales",
  tag_setter_manager: "Setter manager",
  tag_setter: "Setter",
  client_owner: "Client owner",
  client_manager: "Closing manager",
  client_closer: "Closer",
  client_setter_manager: "Setter manager",
  client_setter: "Setter",
};

export const HAT_DESCRIPTIONS: Record<Role, string> = {
  admin: "User management, roles, and Hub infrastructure",
  tag_exec: "Every client, escalation signals, revenue",
  tag_csd: "Whole CS department: every CSM's book, workload, and risk",
  tag_csm: "Assigned clients, onboarding, health",
  tag_sales_manager: "Rep and setter performance across TAG's pipeline",
  tag_sales: "TAG's own pipeline",
  tag_setter_manager: "Setter speed and volume metrics",
  tag_setter: "Today's leads, callbacks, speed to contact",
  client_owner: "One client's spend, ROAS, and outcomes",
  client_manager: "Closer performance and pipeline health",
  client_closer: "Today's calls, pipeline, notes",
  client_setter_manager: "Setter speed and volume metrics",
  client_setter: "Today's leads, callbacks, speed to contact",
};
