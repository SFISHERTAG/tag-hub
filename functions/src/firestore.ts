import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
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
 */
export async function saveTenantResources(
  locationId: string,
  data: {
    name: string;
    slackChannelId: string;
    driveFolderId: string;
    googleDocId?: string;
    ownerEmail?: string;
  }
): Promise<void> {
  await db.collection("locations").doc(locationId).set(
    {
      locationId,
      name: data.name,
      slackChannelId: data.slackChannelId,
      driveFolderId: data.driveFolderId,
      googleDocId: data.googleDocId,
      ownerEmail: data.ownerEmail,
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
    type: "phase1_started" | "phase1_complete" | "phase2_started" | "phase2_complete";
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
