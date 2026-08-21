import { NextResponse, type NextRequest } from "next/server";
import { assignIndividualRole } from "@/lib/auth/groups";
import { isRole, ROLES } from "@/lib/auth/roles";
import { upsertCsmRecord, type CsmRole } from "@/lib/dashboard/csm-directory";
import {
  badRequest,
  handle,
  nullableString,
  readJson,
  requireApiRole,
} from "../../../_lib/http";
import { readLocations, withLocationValidation } from "../../_locations";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/users/[uid]/role
 * Body: { role: Role, locations?: string[], locationsRaw?: string,
 *         email?: string | null, managerEmail?: string | null }
 * 200:  { ok: true }
 *
 * Admin only. Assigns an individual grant, detaching the user from any group
 * so group state and individual state cannot both claim them.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  const { uid } = await params;
  const context = `PUT /api/admin/users/${uid}/role`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const role = body.role;
    if (!isRole(role)) throw badRequest("Invalid role.");

    const email = nullableString(body, "email");
    const managerEmail = nullableString(body, "managerEmail");
    const locations = readLocations(body);

    // Checked before the grant, not after.
    //
    // This precondition used to run after the claims write, so an admin
    // assigning a CS hat to a user with no email on file read "nothing
    // happened" while the role was already live on the account. A
    // precondition that runs after the irreversible step is not one.
    const needsCsRecord = role === ROLES.TAG_CSM || role === ROLES.TAG_CSD;
    if (needsCsRecord && !email) {
      throw badRequest("This user has no email on file — cannot set CS reporting line.");
    }

    await withLocationValidation(() => assignIndividualRole(uid, role, locations));

    // CS org reporting line. Only tag_csm/tag_csd participate in the rollup,
    // and the csm collection is keyed by email, not uid.
    if (needsCsRecord && email) {
      const csmRole: CsmRole = role === ROLES.TAG_CSD ? "csd" : "csm";
      await upsertCsmRecord({ email, role: csmRole, managerEmail });
    }

    return NextResponse.json({ ok: true });
  });
}
