/**
 * Role identifiers and their display labels.
 *
 * Split out from roles.ts deliberately — that file is `server-only` because
 * it also carries the logic that trusts a hat cookie (`effectiveRole`,
 * and the `availableRoles` check in `wearHat`), which has no business
 * running in the browser. This file is
 * just names and copy: nothing here is sensitive, and admin UI that renders
 * a role dropdown needs it client-side to build one. roles.ts re-exports
 * everything here, so every existing server-side import of `ROLES` /
 * `HAT_LABELS` from "./roles" keeps working unchanged.
 */

export const ROLES = [
  "admin",
  "tag_exec",
  "tag_csd",
  "tag_csm",
  "tag_sales_manager",
  "tag_sales",
  "tag_setter_manager",
  "tag_setter",
  "client_owner",
  "client_manager",
  "client_closer",
  "client_setter_manager",
  "client_setter",
] as const;

export type Role = (typeof ROLES)[number];

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
