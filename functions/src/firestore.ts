import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

/**
 * Record a client email on the OTP sign-in whitelist document.
 *
 * Despite the name, this grants nothing. No code anywhere reads
 * `auth/otpWhitelist` — a reader has never existed in this repo's history.
 * Sign-in is gated by Firebase Auth user existence
 * (`app/api/auth/otp/request`) plus the role claims written by
 * `provisionClientOwner`. Until something reads this document it is a record,
 * not a control, and must not be cited as one.
 *
 * Two bugs lived here undetected for exactly that reason:
 *
 * 1. `update()` rejects with NOT_FOUND when the document is absent, which it
 *    is in any project where nothing seeded it — and this runs *before*
 *    `provisionClientOwner` in Phase 1, so it failed the whole webhook short
 *    of creating the user. `set(..., { merge: true })` creates on first write.
 * 2. `arrayUnion` is variadic. Passing an array appended a nested
 *    `["someone@example.com"]` as one element instead of the address itself.
 *
 * Fixing 1 removes an accidental brake on unauthenticated provisioning, so it
 * lands together with `requireWebhookSecret` on Phase 1 rather than before it.
 */
export async function addToOtpWhitelist(email: string): Promise<void> {
  const whitelistRef = db.collection("auth").doc("otpWhitelist");

  const { FieldValue } = await import("@google-cloud/firestore");
  await whitelistRef.set(
    {
      emails: FieldValue.arrayUnion(email.toLowerCase()),
      updatedAt: new Date(),
    },
    { merge: true },
  );
}

/**
 * Create/update a tenant location record in Firestore.
 * Stores the resources we just created.
 *
 * Meta ids are optional here on purpose: most new clients don't have an ad
 * account yet at Phase 2 (funnel isn't even built — that's PR1). When a
 * client comes in already running their own Meta ads and intake captures
 * the id, this is what actually gets it onto the tenant record the Hub
 * reads from (`lib/ghl/tenants.ts`) — previously intake data with a meta
 * account id in it still got written to the onboarding Google Doc but never
 * reached this document, so the dashboard had no way to find it. For
 * clients who connect Meta later, the same fields stay editable in the
 * admin tenant form (Business Settings → Partners connects the account;
 * Business Settings → System Users → tag-hub-server → Add Assets → Ad
 * Accounts grants the token access to it — see
 * docs/meta-live-launch-plan.md — then the id lands here or in the admin
 * form either way).
 */
export async function saveTenantResources(
  locationId: string,
  data: {
    name?: string;
    slackChannelId?: string;
    driveFolderId?: string;
    googleDocId?: string;
    ownerEmail?: string;
    metaAdAccountId?: string;
    metaBusinessId?: string;
    metaPixelId?: string;
    metaSetupStatus?: string;
    metaAccessRequestedAt?: string;
    metaSetupGuidesentAt?: string;
  }
): Promise<void> {
  // Firestore's client rejects explicit `undefined` field values, so only
  // fields the caller actually provided go into the write — this is what
  // lets phase3's partial "just update Meta status" calls merge onto a
  // location phase1 already created without clobbering the rest with
  // undefined.
  const fields: Record<string, string> = {};
  if (data.name !== undefined) fields.name = data.name;
  if (data.slackChannelId !== undefined) fields.slackChannelId = data.slackChannelId;
  if (data.driveFolderId !== undefined) fields.driveFolderId = data.driveFolderId;
  if (data.googleDocId !== undefined) fields.googleDocId = data.googleDocId;
  if (data.ownerEmail !== undefined) fields.ownerEmail = data.ownerEmail;
  if (data.metaAdAccountId) fields.metaAdAccountId = data.metaAdAccountId;
  if (data.metaBusinessId) fields.metaBusinessId = data.metaBusinessId;
  if (data.metaPixelId) fields.metaPixelId = data.metaPixelId;
  if (data.metaSetupStatus) fields.metaSetupStatus = data.metaSetupStatus;
  if (data.metaAccessRequestedAt) fields.metaAccessRequestedAt = data.metaAccessRequestedAt;
  if (data.metaSetupGuidesentAt) fields.metaSetupGuidesentAt = data.metaSetupGuidesentAt;

  await db.collection("locations").doc(locationId).set(
    {
      locationId,
      ...fields,
      services: {
        vslFunnel: true,
        adManagement: true,
        closingTeam: false,
        website: false,
        salesEnablement: false,
      },
      ownerModel: "client",
      createdAt: new Date(),
      provisioned: true,
    },
    { merge: true }
  );
}

/**
 * Log provisioning events for auditing.
 */
export async function logProvisioningEvent(
  locationId: string,
  event: {
    type:
      | "phase1_started"
      | "phase1_complete"
      | "phase2_started"
      | "phase2_complete"
      | "phase3_started"
      | "phase3_access_requested"
      | "phase3_setup_guide_sent";
    timestamp: Date;
    details?: Record<string, unknown>;
    error?: string;
  }
): Promise<void> {
  await db
    .collection("locations")
    .doc(locationId)
    .collection("provisioningLog")
    .add({
      ...event,
      timestamp: event.timestamp,
    });
}

/**
 * Store intake form submission data.
 */
export async function saveIntakeSubmission(
  locationId: string,
  data: Record<string, unknown>
): Promise<void> {
  await db
    .collection("locations")
    .doc(locationId)
    .collection("intakeData")
    .doc("latest")
    .set(
      {
        ...data,
        submittedAt: new Date(),
      },
      { merge: true }
    );
}
