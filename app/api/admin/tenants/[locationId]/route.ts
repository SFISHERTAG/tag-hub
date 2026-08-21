import { NextResponse, type NextRequest } from "next/server";
import {
  getTenant,
  isValidLocationId,
  saveTenant,
  tenantDocExists,
  type Service,
} from "@/lib/ghl/tenants";
import { ROLES } from "@/lib/auth/roles";
import { badRequest, handle, readJson, requireApiRole, type JsonBody } from "../../_lib/http";

export const dynamic = "force-dynamic";

const SERVICES: readonly Service[] = [
  "vslFunnel",
  "adManagement",
  "closingTeam",
  "website",
  "salesEnablement",
];

function readServices(body: JsonBody): Record<Service, boolean> {
  const raw = body.services;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw badRequest('"services" must be an object of service flags.');
  }
  const source = raw as Record<string, unknown>;
  const services = {} as Record<Service, boolean>;
  for (const service of SERVICES) {
    const value = source[service];
    if (typeof value !== "boolean") {
      throw badRequest(`"services.${service}" must be true or false.`);
    }
    services[service] = value;
  }
  return services;
}

function readOwnerModel(body: JsonBody): "client" | "tag" {
  const value = body.ownerModel;
  if (value !== "client" && value !== "tag") {
    throw badRequest('"ownerModel" must be "client" or "tag".');
  }
  return value;
}

/**
 * A location id is about to become a Firestore document id. Rejected here as
 * well as in the form, because a typed URL or a scripted call never sees the
 * form's own check — a `/` above all, which Firestore reads as a path
 * separator rather than a literal character.
 */
function assertValidLocationId(locationId: string): void {
  if (!isValidLocationId(locationId)) throw badRequest("Invalid location id.");
}

/**
 * GET /api/admin/tenants/[locationId]
 * 200: { tenant: Tenant, exists: boolean }
 *
 * Admin only. `exists` is separate from the tenant body because `getTenant`
 * fails closed with placeholder defaults, which makes a missing tenant
 * otherwise indistinguishable from a real one whose fields match them.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const context = `GET /api/admin/tenants/${locationId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    assertValidLocationId(locationId);

    const [tenant, exists] = await Promise.all([
      getTenant(locationId),
      tenantDocExists(locationId),
    ]);

    return NextResponse.json({ tenant, exists });
  });
}

/**
 * PUT /api/admin/tenants/[locationId]
 * Body: { services: Record<Service, boolean>, ownerModel: "client" | "tag",
 *         metaAdAccountId: string, metaBusinessId: string, metaPixelId: string }
 * 200:  { tenant: Tenant }
 *
 * Admin only, and the only write path to this collection. Meta ids are stored
 * as "" rather than omitted when cleared: `firestore()` sets
 * `ignoreUndefinedProperties`, which makes `undefined` a no-op under
 * `merge: true`, so an admin clearing a field would silently leave the old
 * value in place.
 *
 * `name` is deliberately not writable here — it syncs from GHL, and this page
 * must never become a second place a client name is typed.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const context = `PUT /api/admin/tenants/${locationId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    assertValidLocationId(locationId);

    const body = await readJson(request);
    const services = readServices(body);
    const ownerModel = readOwnerModel(body);
    const metaAdAccountId = String(body.metaAdAccountId ?? "").trim();
    const metaBusinessId = String(body.metaBusinessId ?? "").trim();
    const metaPixelId = String(body.metaPixelId ?? "").trim();

    const current = await getTenant(locationId);
    const tenant = {
      ...current,
      services,
      ownerModel,
      metaAdAccountId,
      metaBusinessId,
      metaPixelId,
    };
    await saveTenant(tenant);

    return NextResponse.json({ tenant });
  });
}
