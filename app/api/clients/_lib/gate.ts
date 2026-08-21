import "server-only";
import type { NextResponse } from "next/server";
import { requireApiLocationAccess } from "@/lib/auth/api-session";
import type { Session } from "@/lib/auth/session";
import type { ApiError } from "@/lib/api/errorInterceptor";
import { CSM_BOOK_ROLES } from "../../dashboard/_lib/access";
import { notFound, requireApiRole, unwrap } from "../../dashboard/_lib/http";
import { getClientRecord, type ClientRecord } from "./client-record";

/**
 * The gate every `/api/clients/[clientId]/**` endpoint passes through.
 *
 * These endpoints were ported with a role check only, on the reasoning that
 * dropping the `locationId` parameter had removed the audit's
 * caller-supplied-id pattern: "there is nothing to validate if the caller never
 * supplies it." That is the error. The caller still supplies `clientId`, and
 * `clientId` selects the location — it is the same question asked one
 * indirection later, and the answer still has to be checked.
 *
 * `CSM_BOOK_ROLES` is `[tag_csm, tag_csd, tag_exec, admin]`, and `tag_csm` is
 * not universally scoped in this codebase's own model: `getSession` gives
 * `listAllLocationIds()` only to exec, CSD and admin, and `ownsLocation` lets a
 * CSM reach a location outside their grant only while actively impersonating
 * exactly that tenant. So the role says "staff", never "which tenant".
 *
 * The proof this was wrong rather than merely undefended: the same actor asking
 * for the same tenant is refused by `GET /api/ghl/locations/{id}/today`, which
 * runs `gateLocation`. Two endpoint families, one access model, opposite
 * answers. The GHL side is also backstopped inside `ghl()` itself; the Meta and
 * Drive paths these routes reach have no equivalent, so the route was the only
 * thing there was.
 *
 * Cross-book *visibility* is deliberate and is not changed here: a CSM can
 * still list a peer's book through `/api/clients`, which is the documented
 * coverage model. What they cannot do is read another tenant's Meta campaigns,
 * Drive assets, alerts or Phase 3 state without entering that tenant — which is
 * exactly the mechanism Story 3.3 defines for taking over a client.
 */

export type ClientGate =
  | { ok: true; session: Session; record: ClientRecord }
  | { ok: false; response: NextResponse<ApiError> };

export async function gateClient(clientId: string, context: string): Promise<ClientGate> {
  const roleGate = await requireApiRole(CSM_BOOK_ROLES, context);
  if (!roleGate.ok) return { ok: false, response: roleGate.response };

  const record = unwrap(await getClientRecord(clientId));
  if (!record) throw notFound(`No client with id "${clientId}".`);

  // A client record with no location cannot be tenant-checked, so it is not
  // handed out. Failing closed here is the difference between "this client has
  // no GHL account yet" and "this client's tenant could not be verified".
  if (!record.ghlLocationId) {
    return { ok: true, session: roleGate.session, record };
  }

  const locationGate = await requireApiLocationAccess(record.ghlLocationId, context);
  if (!locationGate.ok) return { ok: false, response: locationGate.response };

  return { ok: true, session: locationGate.session, record };
}
