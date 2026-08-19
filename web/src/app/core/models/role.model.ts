/**
 * Port of lib/auth/role-labels.ts. Keep this list in sync with the backend —
 * it is the client-side mirror of the single source of truth in that file,
 * not an independent definition (see CLAUDE.md's permission-model contract).
 */
export const ROLES = [
  'admin',
  'tag_exec',
  'tag_csd',
  'tag_csm',
  'tag_sales_manager',
  'tag_sales',
  'tag_setter_manager',
  'tag_setter',
  'client_owner',
  'client_manager',
  'client_closer',
  'client_setter_manager',
  'client_setter',
] as const;

export type Role = (typeof ROLES)[number];

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
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
