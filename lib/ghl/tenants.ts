import "server-only";
import { repository } from "@/lib/data";

export type Service = "vslFunnel" | "adManagement" | "closingTeam" | "website" | "salesEnablement";

export type Tenant = {
  locationId: string;
  name: string;
  services: Record<Service, boolean>;
  metaAdAccountId?: string;
  metaBusinessId?: string;
  metaPixelId?: string;
  ownerModel: "client" | "tag";
  /**
   * GHL user id of the client owner, when they're also assigned to run calls
   * themselves. Appointments read `assignedUserId`, not a contact id — GHL
   * has no native "organizer" concept beyond the assigned staff member — so
   * this is what Story 4.6's owner calendar filters on. Unset until an admin
   * configures it for a tenant.
   */
  ownerGhlUserId?: string;
};


/**
 * Whether a string is safe to use as a Firestore document id for this
 * collection. GHL location ids are alphanumeric; rejecting everything else
 * — `/` above all, which Firestore reads as a path separator — keeps a typed
 * or pasted id from ever addressing something other than a flat document
 * under `locations/`.
 */
/*
 * This module is named for "tenants" and the collection is `locations`. It held
 * a `TENANTS_COLLECTION = "locations"` constant saying so, now unused because
 * the path lives in the repository seam. Keeping the note: the Postgres table
 * in migration 003 is `tenants`, the Firestore collection is `locations`, and
 * this file is named for the first while reading the second. Three names, one
 * entity. Story 14.4 has to settle it rather than inherit it.
 */

export function isValidLocationId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Get a tenant by location ID. Returns defaults if document missing (fail closed). */
export async function getTenant(locationId: string): Promise<Tenant> {
  const data = await repository().locations.doc(locationId).get();

  if (!data) {
    // Fail closed: no services if document missing
    return {
      locationId,
      name: `Tenant ${locationId}`,
      services: {
        vslFunnel: false,
        adManagement: false,
        closingTeam: false,
        website: false,
        salesEnablement: false,
      },
      ownerModel: "client",
    };
  }

  return {
    locationId,
    name: data.name ?? `Tenant ${locationId}`,
    services: {
      vslFunnel: data.services?.vslFunnel ?? false,
      adManagement: data.services?.adManagement ?? false,
      closingTeam: data.services?.closingTeam ?? false,
      website: data.services?.website ?? false,
      salesEnablement: data.services?.salesEnablement ?? false,
    },
    ownerModel: data.ownerModel ?? "client",
    metaAdAccountId: data.metaAdAccountId,
    metaBusinessId: data.metaBusinessId,
    metaPixelId: data.metaPixelId,
    ownerGhlUserId: data.ownerGhlUserId,
  };
}

/**
 * Whether a tenant document actually exists, independent of `getTenant()`'s
 * fail-closed defaults — those make a missing tenant indistinguishable from
 * a real one whose fields happen to match the placeholder values.
 */
export async function tenantDocExists(locationId: string): Promise<boolean> {
  return (await repository().locations.doc(locationId).get()) !== null;
}

/** Save/update a tenant. Admin operation. */
export async function saveTenant(tenant: Tenant): Promise<void> {
  await repository().locations.doc(tenant.locationId).set(tenant, { merge: true });
}

/** List all tenant IDs. Used for tag_exec to get all locations. */
export async function listAllLocationIds(): Promise<string[]> {
  // The projection is load-bearing, not a tidy-up: this reads one field across
  // every location, and dropping it turns a key scan into a full read of the
  // whole tenant registry.
  const found = await repository().locations.list({ select: ["locationId"] });
  return found.map(({ id }) => id);
}

/** Check if a tenant has a service. */
export function hasService(tenant: Tenant, service: Service): boolean {
  return tenant.services[service] ?? false;
}
