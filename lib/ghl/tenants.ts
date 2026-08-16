import "server-only";
import { firestore } from "@/lib/firestore";

export type Service = "vslFunnel" | "adManagement" | "closingTeam" | "website" | "salesEnablement";

export type Tenant = {
  locationId: string;
  name: string;
  services: Record<Service, boolean>;
  metaAdAccountId?: string;
  metaBusinessId?: string;
  metaPixelId?: string;
  ownerModel: "client" | "tag";
};

const TENANTS_COLLECTION = "locations";

/**
 * Whether a string is safe to use as a Firestore document id for this
 * collection. GHL location ids are alphanumeric; rejecting everything else
 * — `/` above all, which Firestore reads as a path separator — keeps a typed
 * or pasted id from ever addressing something other than a flat document
 * under `locations/`.
 */
export function isValidLocationId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Get a tenant by location ID. Returns defaults if document missing (fail closed). */
export async function getTenant(locationId: string): Promise<Tenant> {
  const db = firestore();
  const doc = await db.collection(TENANTS_COLLECTION).doc(locationId).get();

  if (!doc.exists) {
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

  const data = doc.data() as Partial<Tenant>;
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
  };
}

/**
 * Whether a tenant document actually exists, independent of `getTenant()`'s
 * fail-closed defaults — those make a missing tenant indistinguishable from
 * a real one whose fields happen to match the placeholder values.
 */
export async function tenantDocExists(locationId: string): Promise<boolean> {
  const db = firestore();
  const doc = await db.collection(TENANTS_COLLECTION).doc(locationId).get();
  return doc.exists;
}

/** Save/update a tenant. Admin operation. */
export async function saveTenant(tenant: Tenant): Promise<void> {
  const db = firestore();
  await db.collection(TENANTS_COLLECTION).doc(tenant.locationId).set(tenant, { merge: true });
}

/** List all tenant IDs. Used for tag_exec to get all locations. */
export async function listAllLocationIds(): Promise<string[]> {
  const db = firestore();
  const snapshot = await db.collection(TENANTS_COLLECTION).select("locationId").get();
  return snapshot.docs.map((doc) => doc.id);
}

/** Check if a tenant has a service. */
export function hasService(tenant: Tenant, service: Service): boolean {
  return tenant.services[service] ?? false;
}
