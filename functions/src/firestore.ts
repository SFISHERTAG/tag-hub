import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  // Matches lib/firestore.ts on the app side, which has always had it.
  //
  // Without this, any write carrying an optional field that happens to be
  // undefined throws "Cannot use 'undefined' as a Firestore value". That is
  // not a theoretical shape here: `logProvisioningEvent` spreads a `details`
  // object built from local variables that are genuinely undefined on some
  // real paths, and `saveIntakeSubmission` spreads whatever the intake form
  // sent. The throw lands after the external resources have been created,
  // which is what turns a bad write into duplicated client resources.
  ignoreUndefinedProperties: true,
});

/**
 * Add a user email to the OTP sign-in whitelist.
 * Allows them to authenticate via TAG Success Hub.
 */
export async function addToOtpWhitelist(email: string): Promise<void> {
  const whitelistRef = db.collection("auth").doc("otpWhitelist");

  const { FieldValue } = await import("@google-cloud/firestore");
  await whitelistRef.update({
    emails: FieldValue.arrayUnion([email.toLowerCase()]),
    updatedAt: new Date(),
  });
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
