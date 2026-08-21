/* eslint-disable import/no-restricted-paths -- Predates the metric registry.
   Queries directly instead of going through a scoped metric fetch. Not a leak
   today (nothing here is per-user), but it is the pattern the zone exists to
   stop, so this comment is the migration marker: move the data path into
   lib/dashboard/metrics.ts and delete this line. See docs/ROLE_SCOPE_MODEL.md. */
import "server-only";
import { firestore } from "@/lib/firestore";

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

const COLLECTION = "csm";

export async function getCsmRecord(email: string): Promise<CsmRecord | null> {
  const doc = await firestore().collection(COLLECTION).doc(email).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    email,
    role: data.role,
    managerEmail: data.managerEmail ?? null,
  };
}

/** Every `csm` record — small enough (one row per CS staffer) to list in full for the admin Users page. */
export async function listCsmRecords(): Promise<CsmRecord[]> {
  const snapshot = await firestore().collection(COLLECTION).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      email: doc.id,
      role: data.role,
      managerEmail: data.managerEmail ?? null,
    };
  });
}

/** Every CSM whose `managerEmail` is this CSD — the CSD's team. */
export async function getTeamEmails(csdEmail: string): Promise<string[]> {
  const snapshot = await firestore()
    .collection(COLLECTION)
    .where("managerEmail", "==", csdEmail)
    .get();
  return snapshot.docs.map((doc) => doc.id);
}

/** Create or update a CSM's role and reporting line. Admin-only write path — see app/admin/users/actions.ts. */
export async function upsertCsmRecord(record: CsmRecord): Promise<void> {
  await firestore()
    .collection(COLLECTION)
    .doc(record.email)
    .set(
      {
        role: record.role,
        managerEmail: record.managerEmail,
      },
      { merge: true },
    );
}
