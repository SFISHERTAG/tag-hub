import { NextResponse, type NextRequest } from "next/server";
import { assignIndividualRole } from "@/lib/auth/groups";
import { isRole, ROLES } from "@/lib/auth/roles";
import { GrantValidationError, SCOPE_LEVELS, type ScopeLevel } from "@/lib/auth/grants";
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
 *         email?: string | null, managerEmail?: string | null,
 *         scope?: "self" | "team" | "tenancy" | null, team?: string[] | null }
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
    const scope = readScope(body);
    const team = readTeam(body);

    // Sent together or not at all: a team without a scope cannot be stored, and
    // rejecting it here says so in the admin's own words rather than letting
    // normaliseGrants phrase it as a grant problem.
    if (team !== undefined && scope !== "team") {
      throw badRequest('`team` is only meaningful with `scope: "team"`.');
    }

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

    // GrantValidationError is a bad request, not a server fault: every case it
    // covers is something the caller sent. Left to bubble it would surface as a
    // 500 and read as an outage rather than a rejected team.
    try {
      await withLocationValidation(() =>
        assignIndividualRole(uid, role, locations, scope, team),
      );
    } catch (error) {
      if (error instanceof GrantValidationError) throw badRequest(error.message);
      throw error;
    }

    // CS org reporting line. Only tag_csm/tag_csd participate in the rollup,
    // and the csm collection is keyed by email, not uid.
    if (needsCsRecord && email) {
      const csmRole: CsmRole = role === ROLES.TAG_CSD ? "csd" : "csm";
      await upsertCsmRecord({ email, role: csmRole, managerEmail });
    }

    return NextResponse.json({ ok: true });
  });
}

/**
 * Reads `scope`, treating null and absent as "clear it".
 *
 * Clearing matters as much as setting (AC8): a grant with no scope falls back
 * to the role default, so this is how an admin undoes a per-hat override
 * without having to know what the default is.
 */
function readScope(body: Record<string, unknown>): ScopeLevel | undefined {
  const raw = body.scope;
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (!(SCOPE_LEVELS as readonly unknown[]).includes(raw)) {
    throw badRequest(`Unknown scope. Expected one of: ${SCOPE_LEVELS.join(", ")}.`);
  }
  return raw as ScopeLevel;
}

/** Reads `team`, treating null and absent as "clear it". Membership is validated deeper. */
function readTeam(body: Record<string, unknown>): string[] | undefined {
  const raw = body.team;
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.some((uid) => typeof uid !== "string" || uid === "")) {
    throw badRequest("`team` must be an array of uids.");
  }
  return raw as string[];
}
