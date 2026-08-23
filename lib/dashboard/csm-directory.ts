/*
 * The `import/no-restricted-paths` disable that used to sit here is gone: the
 * data path now runs through the `lib/data` repository seam (story 14.1), so
 * the zone no longer fires and eslint reported the directive as unused.
 *
 * The concern it recorded is NOT resolved and is kept here deliberately. This
 * still queries directly rather than going through a scoped metric fetch. Not
 * a leak today, since nothing here is per-user, but it is the pattern the zone
 * exists to stop. The remaining move is into lib/dashboard/metrics.ts.
 * See docs/ROLE_SCOPE_MODEL.md.
 */
import "server-only";
import { repository } from "@/lib/data";

/**
 * CS org reporting lines.
 *
 * `clients.csm_assigned` (see csm-clients.ts) says which CSM owns a client;
 * it says nothing about who that CSM reports to. This collection is the
 * missing piece — a CSD's "whole department" rollup and a CSM's "my book"
 * scope both read from it. Keyed by email to match `csm_assigned`'s existing
 * free-text-email convention rather than inventing a second identifier.
 *
 * Firestore collection: `csm/{email}`. Sketched (unimplemented) in
 * docs/csm-dashboard-scope.md before this file existed.
 */

export type CsmRole = "csm" | "csd" | "exec";

export type CsmRecord = {
  email: string;
  role: CsmRole;
  managerEmail: string | null;
};

const csm = () => repository().csm;

export async function getCsmRecord(email: string): Promise<CsmRecord | null> {
  const data = await csm().doc(email).get();
  if (!data) return null;
  return {
    email,
    role: data.role,
    managerEmail: data.managerEmail ?? null,
  };
}

/** Every `csm` record — small enough (one row per CS staffer) to list in full for the admin Users page. */
export async function listCsmRecords(): Promise<CsmRecord[]> {
  const found = await csm().list();
  return found.map(({ id, data }) => ({
    email: id,
    role: data.role,
    managerEmail: data.managerEmail ?? null,
  }));
}

/** Every CSM whose `managerEmail` is this CSD — the CSD's team. */
export async function getTeamEmails(csdEmail: string): Promise<string[]> {
  const found = await csm().list({
    where: [{ field: "managerEmail", op: "==", value: csdEmail }],
  });
  return found.map(({ id }) => id);
}

/** Create or update a CSM's role and reporting line. Admin-only write path — see app/admin/users/actions.ts. */
export async function upsertCsmRecord(record: CsmRecord): Promise<void> {
  await csm()
    .doc(record.email)
    .set(
      {
        email: record.email,
        role: record.role,
        managerEmail: record.managerEmail,
      },
      { merge: true },
    );
}
