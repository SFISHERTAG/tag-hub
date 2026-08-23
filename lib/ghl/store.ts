import "server-only";
import { repository } from "@/lib/data";

/**
 * Persistence for OAuth credentials.
 *
 * Two ways a location becomes reachable:
 *
 *   1. Agency install — one company token that mints short-lived location
 *      tokens on demand. This is how sub-accounts under our own agency get
 *      served.
 *
 *   2. Direct location install — the app installed onto a single sub-account.
 *      Yields a location token with its own refresh token. This is the only
 *      path for a client who stays inside their own agency, so it is not a
 *      testing convenience: it is half the portfolio.
 *
 * Both paths write a document under `ghl/agency/locations/{locationId}`, so
 * token resolution does not care which one produced it.
 *
 * Agency tokens are keyed by company. They used to share one document, which
 * meant a second agency completing a company-level install silently overwrote
 * ours — including `companyId`, so every subsequent mint for every one of our
 * own sub-accounts would have been attempted against the wrong company and
 * failed. One outside install, whole portfolio dark, no alarm. Keying by
 * company makes that install land in its own document instead.
 *
 * The first agency to install becomes the primary, recorded on the `ghl/agency`
 * root. The primary is what mints for a location whose owning agency is not
 * recorded, which is every location stored before this change.
 */

/**
 * Legacy single-token document, now the root that records which company is
 * primary. Pre-existing deployments have a full token here; `loadAgencyToken`
 * migrates it into the per-company layout on first read.
 */
const AGENCY_ROOT = "ghl/agency";
const agencyDoc = (companyId: string) => `ghl/agency/companies/${companyId}`;
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

/**
 * The root document. Post-migration it holds only `primaryCompanyId`; the
 * token fields are what a pre-migration deployment left behind.
 */
type AgencyRoot = Partial<StoredAgencyToken> & { primaryCompanyId?: string };

/** Company ids are path segments, so they get the same guard location ids do. */
function isValidCompanyId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export class InvalidCompanyIdError extends Error {
  constructor(readonly companyId: string) {
    super(`Refusing to store an agency token under an unusable company id.`);
    this.name = "InvalidCompanyIdError";
  }
}

async function readRoot(): Promise<AgencyRoot | null> {
  return repository().ghlAgencyRoot.get();
}

/** The company whose token serves locations with no recorded owner. */
export async function loadPrimaryCompanyId(): Promise<string | null> {
  const root = await readRoot();
  return root?.primaryCompanyId ?? root?.companyId ?? null;
}

/**
 * Stores an agency token under its own company.
 *
 * Never overwrites another company's document, and never reassigns the primary
 * once one is set — a later install by a different agency is stored, but it
 * does not inherit the portfolio.
 */
export async function saveAgencyToken(token: StoredAgencyToken): Promise<void> {
  if (!isValidCompanyId(token.companyId)) {
    throw new InvalidCompanyIdError(token.companyId);
  }

  await repository().ghlCompanyTokens.doc(token.companyId).set(token);

  const primary = await loadPrimaryCompanyId();
  if (!primary) {
    await repository().ghlAgencyRoot.set(
      { primaryCompanyId: token.companyId },
      { merge: true },
    );
  }
}

/**
 * Loads an agency token: a named company's, or the primary's when unnamed.
 *
 * Migrates the legacy root token into the per-company layout the first time it
 * is read, so a deployment carrying a live agency install keeps working with no
 * migration step and no reinstall.
 */
export async function loadAgencyToken(
  companyId?: string,
): Promise<StoredAgencyToken | null> {
  const root = await readRoot();
  const wanted = companyId ?? root?.primaryCompanyId ?? root?.companyId;
  if (!wanted || !isValidCompanyId(wanted)) return null;

  const stored = await repository().ghlCompanyTokens.doc(wanted).get();
  if (stored) return stored;

  // Legacy: the root still holds the token itself. Copy it down, then record
  // it as primary so the next read takes the path above.
  if (root?.accessToken && root.refreshToken && root.companyId === wanted) {
    const migrated: StoredAgencyToken = {
      accessToken: root.accessToken,
      refreshToken: root.refreshToken,
      companyId: root.companyId,
      expiresAt: root.expiresAt ?? 0,
      updatedAt: root.updatedAt ?? 0,
    };
    await repository().ghlCompanyTokens.doc(wanted).set(migrated);
    await repository().ghlAgencyRoot.set({ primaryCompanyId: wanted }, { merge: true });
    return migrated;
  }

  return null;
}

/** Every agency that has completed an install, primary first. */
export async function listAgencyCompanyIds(): Promise<string[]> {
  return repository().ghlCompanyTokens.listIds();
}

export type StoredLocationToken = {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Present only for direct installs; minted tokens are re-minted instead. */
  refreshToken?: string;
  /** How this credential was obtained. */
  source: "agency-mint" | "direct-install";
  /**
   * Which agency this location is reachable through. Recorded on mint so a
   * re-mint goes back to the same company rather than guessing the primary.
   * Absent on direct installs, and on anything stored before agency tokens
   * were keyed by company.
   */
  agencyCompanyId?: string;
  updatedAt: number;
};

export async function saveLocationToken(
  locationId: string,
  token: StoredLocationToken,
): Promise<void> {
  await repository().ghlLocationTokens.doc(locationId).set(token);
}

export async function loadLocationToken(
  locationId: string,
): Promise<StoredLocationToken | null> {
  return repository().ghlLocationTokens.doc(locationId).get();
}

/** Locations with a stored credential, whatever its source. */
export async function listStoredLocationIds(): Promise<string[]> {
  return repository().ghlLocationTokens.listIds();
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
  await repository().appointmentOutcomes(locationId).doc(appointmentId).set(outcome);
}

export async function loadAppointmentOutcomes(
  locationId: string,
  appointmentIds: string[],
): Promise<Map<string, AppointmentOutcome>> {
  const found = new Map<string, AppointmentOutcome>();
  if (appointmentIds.length === 0) return found;

  // One round trip, not N: getAll takes the whole id list.
  const stored = await repository().appointmentOutcomes(locationId).getAll(appointmentIds);
  for (const { id, data } of stored) found.set(id, data);
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
  const outcomes = await repository().appointmentOutcomes(locationId).list({
    orderBy: { field: "markedAt", direction: "desc" },
    limit: 1000, // reasonable recent window
  });

  const latestByContact = new Map<string, FollowUpCandidate>();
  const attemptsByContact = new Map<string, number>();

  // Docs arrive newest-first, so the first hit per contact is the latest outcome.
  for (const { id: appointmentDocId, data: outcome } of outcomes) {
    if (outcome.status !== "noshow" && outcome.status !== "invalid") continue;
    const contactId = outcome.contactId;
    if (!contactId) continue; // pre-2.8 records carry no contactId; nothing to key on

    attemptsByContact.set(contactId, (attemptsByContact.get(contactId) ?? 0) + 1);
    if (latestByContact.has(contactId)) continue; // already have this contact's newest outcome

    latestByContact.set(contactId, {
      appointmentId: appointmentDocId,
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
  return repository().followUpConfig(locationId);
}

export async function getFollowUpConfig(
  locationId: string,
): Promise<FollowUpConfig> {
  const data = await followUpConfigDoc(locationId).get();
  if (!data) return DEFAULT_FOLLOW_UP_CONFIG;
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
