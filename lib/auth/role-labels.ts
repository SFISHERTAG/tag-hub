/**
 * Role identifiers and their display labels.
 *
 * Split out from roles.ts deliberately — that file is `server-only` because
 * it also carries the logic that trusts a hat cookie (`effectiveHat`,
 * `canWear`), which has no business running in the browser. This file is
 * just names and copy: nothing here is sensitive, and admin UI that renders
 * a role dropdown needs it client-side to build one. roles.ts re-exports
 * everything here, so every existing server-side import of `ROLES` /
 * `HAT_LABELS` from "./roles" keeps working unchanged.
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
