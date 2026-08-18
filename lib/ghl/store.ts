import "server-only";
import { firestore } from "@/lib/firestore";

/**
 * Persistence for OAuth credentials.
 *
 * Two ways a location becomes reachable:
 *
 *   1. Agency install — one company token that mints short-lived location
 *      tokens on demand. This is how all 40 sub-accounts get served.
 *
 *   2. Direct location install — the app installed onto a single sub-account.
 *      Yields a location token with its own refresh token. Useful for testing
 *      against one client before rolling out agency-wide.
 *
 * Both paths write a document under `ghl/agency/locations/{locationId}`, so
 * token resolution does not care which one produced it.
 */

export { firestore };

const AGENCY_DOC = "ghl/agency";
const locationDoc = (locationId: string) =>
  `ghl/agency/locations/${locationId}`;

export type StoredAgencyToken = {
  accessToken: string;
  refreshToken: string;
  companyId: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  updatedAt: number;
};

export async function saveAgencyToken(token: StoredAgencyToken): Promise<void> {
  await firestore().doc(AGENCY_DOC).set(token);
}

export async function loadAgencyToken(): Promise<StoredAgencyToken | null> {
  const snapshot = await firestore().doc(AGENCY_DOC).get();
  return snapshot.exists ? (snapshot.data() as StoredAgencyToken) : null;
}

export type StoredLocationToken = {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Present only for direct installs; minted tokens are re-minted instead. */
  refreshToken?: string;
  /** How this credential was obtained. */
  source: "agency-mint" | "direct-install";
  updatedAt: number;
};

export async function saveLocationToken(
  locationId: string,
  token: StoredLocationToken,
): Promise<void> {
  await firestore().doc(locationDoc(locationId)).set(token);
}

export async function loadLocationToken(
  locationId: string,
): Promise<StoredLocationToken | null> {
  const snapshot = await firestore().doc(locationDoc(locationId)).get();
  return snapshot.exists ? (snapshot.data() as StoredLocationToken) : null;
}

/** Locations with a stored credential, whatever its source. */
export async function listStoredLocationIds(): Promise<string[]> {
  const snapshot = await firestore()
    .collection("ghl/agency/locations")
    .listDocuments();
  return snapshot.map((doc) => doc.id);
}

/* ------------------------------------------------------------------ */
/* Appointment outcome context                                         */
/* ------------------------------------------------------------------ */

/**
 * When an outcome was recorded, relative to the appointment itself.
 *
 * GHL stores the status but not when it was set, and the two DQ cases mean
 * opposite things: disqualifying before the call is a targeting failure with
 * no call attached, while disqualifying during one means a real person showed
 * and did not qualify. Collapsing them corrupts show rate — the first should
 * leave the denominator entirely, the second counts as showed.
 *
 * This is exactly the kind of thing Firestore is for here: GHL remains the
 * system of record for the status, and we store only what it has no concept of.
 */
export type OutcomeTiming = "pre-call" | "on-call" | "post-call";

export type AppointmentOutcome = {
  status: string;
  timing: OutcomeTiming;
  /** Epoch milliseconds. */
  markedAt: number;
  appointmentStartsAt: number;
  appointmentEndsAt: number;
  /**
   * Denormalized so the follow-up queue (story 2.8) can render without a
   * per-row contact fetch — contactId to detect a newer booking, name/title
   * because "who is this" can't come from anywhere else without one.
   */
  contactId?: string;
  contactName?: string;
  appointmentTitle?: string;
};

export function classifyTiming(
  markedAt: number,
  startsAt: number,
  endsAt: number,
): OutcomeTiming {
  if (markedAt < startsAt) return "pre-call";
  if (markedAt <= endsAt) return "on-call";
  return "post-call";
}

export async function saveAppointmentOutcome(
  locationId: string,
  appointmentId: string,
  outcome: AppointmentOutcome,
): Promise<void> {
  await firestore()
    .doc(`locations/${locationId}/appointmentOutcomes/${appointmentId}`)
    .set(outcome);
}

export async function loadAppointmentOutcomes(
  locationId: string,
  appointmentIds: string[],
): Promise<Map<string, AppointmentOutcome>> {
  const found = new Map<string, AppointmentOutcome>();
  if (appointmentIds.length === 0) return found;

  const refs = appointmentIds.map((id) =>
    firestore().doc(`locations/${locationId}/appointmentOutcomes/${id}`),
  );

  const snapshots = await firestore().getAll(...refs);
  for (const snapshot of snapshots) {
    if (snapshot.exists) {
      found.set(snapshot.id, snapshot.data() as AppointmentOutcome);
    }
  }
  return found;
}

/** Follow-up candidate: appointment marked no-show or DQ with no newer appointment on same contact. */
export type FollowUpCandidate = {
  appointmentId: string;
  contactId: string;
  contactName: string;
  appointmentTitle: string;
  markedAt: number;
  status: "noshow" | "invalid";
  timing: OutcomeTiming;
  /** How many no-show/DQ outcomes this contact has on record, latest included. */
  attempts: number;
};

/**
 * Candidates for the follow-up queue (story 2.8): appointments marked
 * no-show or DQ, most recent outcome per contact only — an earlier no-show
 * followed by a later DQ on the same contact should show once, not twice.
 *
 * Aging out and "cleared by a newer booking" are both applied by the caller
 * (today/page.tsx), which already has the appointment list needed to check
 * for a newer booking — this function stays a single Firestore query with no
 * per-candidate fetch, per AC5.
 */
export async function getFollowUpCandidates(
  locationId: string,
): Promise<FollowUpCandidate[]> {
  const outcomes = await firestore()
    .collection(`locations/${locationId}/appointmentOutcomes`)
    .orderBy("markedAt", "desc")
    .limit(1000) // reasonable recent window
    .get();

  const latestByContact = new Map<string, FollowUpCandidate>();
  const attemptsByContact = new Map<string, number>();

  // Docs arrive newest-first, so the first hit per contact is the latest outcome.
  for (const doc of outcomes.docs) {
    const outcome = doc.data() as AppointmentOutcome;
    if (outcome.status !== "noshow" && outcome.status !== "invalid") continue;
    const contactId = outcome.contactId;
    if (!contactId) continue; // pre-2.8 records carry no contactId; nothing to key on

    attemptsByContact.set(contactId, (attemptsByContact.get(contactId) ?? 0) + 1);
    if (latestByContact.has(contactId)) continue; // already have this contact's newest outcome

    latestByContact.set(contactId, {
      appointmentId: doc.id,
      contactId,
      contactName: outcome.contactName ?? "Unnamed",
      appointmentTitle: outcome.appointmentTitle ?? "Untitled",
      markedAt: outcome.markedAt,
      status: outcome.status as "noshow" | "invalid",
      timing: outcome.timing,
      attempts: 0, // filled in below, once all docs for this contact are counted
    });
  }

  for (const candidate of latestByContact.values()) {
    candidate.attempts = attemptsByContact.get(candidate.contactId) ?? 1;
  }

  return [...latestByContact.values()].sort((a, b) => b.markedAt - a.markedAt);
}

/* ------------------------------------------------------------------ */
/* Follow-up queue configuration                                       */
/* ------------------------------------------------------------------ */

export type FollowUpThresholdMode = "attempts" | "days";

export type FollowUpConfig = {
  mode: FollowUpThresholdMode;
  /** Attempt count or day count, depending on `mode`. */
  value: number;
};

export const DEFAULT_FOLLOW_UP_CONFIG: FollowUpConfig = {
  mode: "days",
  value: 7,
};

function followUpConfigDoc(locationId: string) {
  return firestore().doc(`locations/${locationId}/settings/followUp`);
}

export async function getFollowUpConfig(
  locationId: string,
): Promise<FollowUpConfig> {
  const snapshot = await followUpConfigDoc(locationId).get();
  if (!snapshot.exists) return DEFAULT_FOLLOW_UP_CONFIG;
  const data = snapshot.data() as Partial<FollowUpConfig>;
  if (
    (data.mode === "attempts" || data.mode === "days") &&
    typeof data.value === "number" &&
    data.value > 0
  ) {
    return { mode: data.mode, value: data.value };
  }
  return DEFAULT_FOLLOW_UP_CONFIG;
}

export async function saveFollowUpConfig(
  locationId: string,
  config: FollowUpConfig,
): Promise<void> {
  await followUpConfigDoc(locationId).set(config);
}

/*
 * Audit logging moved to lib/audit/store.ts — generalized beyond
 * impersonation enter/exit to any actor/action/target, per story 3.5.
 * Nothing outside this file called saveAuditLogEntry/getAuditLogEntries yet
 * (checked before moving), so this is a clean relocation, not a breaking
 * change.
 */
