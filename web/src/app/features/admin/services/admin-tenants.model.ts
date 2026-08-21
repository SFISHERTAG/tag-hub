/**
 * Wire shapes for `/api/admin/tenants*`, mirrored from lib/ghl/tenants.ts.
 */
export const SERVICE_IDS = [
  'vslFunnel',
  'adManagement',
  'closingTeam',
  'website',
  'salesEnablement',
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export const SERVICE_LABELS: Record<ServiceId, string> = {
  vslFunnel: 'VSL funnel',
  adManagement: 'Ad management',
  closingTeam: 'Closing team',
  website: 'Website',
  salesEnablement: 'Sales enablement',
};

export type OwnerModel = 'client' | 'tag';

export interface Tenant {
  readonly locationId: string;
  /** Syncs from GHL. Deliberately not writable here — see TenantSettings. */
  readonly name: string;
  readonly services: Readonly<Record<ServiceId, boolean>>;
  readonly metaAdAccountId?: string;
  readonly metaBusinessId?: string;
  readonly metaPixelId?: string;
  readonly ownerModel: OwnerModel;
  readonly ownerGhlUserId?: string;
}

export interface TenantList {
  readonly tenants: readonly Tenant[];
}

/**
 * `exists` is carried separately because `getTenant` fails closed with
 * placeholder defaults: without this flag a location that has never been
 * configured is indistinguishable from a real one whose fields happen to match
 * the placeholders, and the form would say "editing Acme" over an empty record.
 */
export interface TenantDetail {
  readonly tenant: Tenant;
  readonly exists: boolean;
}

/** Exactly the fields `PUT /api/admin/tenants/[locationId]` accepts. */
export interface TenantSettings {
  readonly services: Record<ServiceId, boolean>;
  readonly ownerModel: OwnerModel;
  readonly metaAdAccountId: string;
  readonly metaBusinessId: string;
  readonly metaPixelId: string;
}

export interface SavedTenant {
  readonly tenant: Tenant;
}

/**
 * Mirrors `isValidLocationId` in lib/ghl/tenants.ts. A convenience so a
 * malformed id is never typed in the first place — the server module is still
 * the authority, and re-checks before the id becomes a Firestore document path.
 */
const LOCATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidLocationId(value: string): boolean {
  return LOCATION_ID_PATTERN.test(value);
}

export function enabledServiceCount(tenant: Tenant): number {
  return SERVICE_IDS.filter((service) => tenant.services[service]).length;
}
