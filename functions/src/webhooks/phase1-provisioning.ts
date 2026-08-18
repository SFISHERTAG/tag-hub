import { Request, Response } from "express";
import { cloneLocation, findLocationByName, createOpportunity, getPipelines } from "../ghl";
import { createSlackChannel, inviteSlackGuest } from "../slack";
import { createDriveFolder } from "../google";
import { addToOtpWhitelist, saveTenantResources, logProvisioningEvent } from "../firestore";
import { sendIntakeFormEmail, sendProvisioningConfirmation } from "../email";
import { hasBeenProcessed, markProcessed, clearProcessed, contentEventId } from "../lib/webhooks/idempotency";

/**
 * Phase 1: Webhook triggered when checkbox "Initiate Onboarding" is checked
 * and the deal is in "Closed Won" stage.
 *
 * Actions:
 * 1. Clone GHL sub-account from template
 * 2. Create Slack channel (single-channel guest)
 * 3. Create Drive folder (Shared Drive)
 * 4. Add client email to OTP whitelist
 * 5. Create Fulfillment pipeline opportunity
 * 6. Email intake form link to client
 */
export async function handlePhase1(req: Request, res: Response): Promise<void> {
  let eventId: string | undefined;
  try {
    const webhook = req.body;

    // Extract data from GHL webhook
    const {
      opportunity: opportunityData,
      contact: contactData,
    } = webhook;

    if (!opportunityData || !contactData) {
      res.status(400).json({ error: "Missing opportunity or contact data" });
      return;
    }

    const opportunityId = opportunityData.id;
    const dealName = opportunityData.name;
    const clientName = contactData.name || dealName;
    const clientEmail = contactData.email;

    if (!clientEmail) {
      res.status(400).json({ error: "Client email required" });
      return;
    }

    // GHL retries this webhook on a slow response — without a guard, the
    // retry re-clones the GHL location, re-creates the Slack channel/Drive
    // folder, and re-sends the intake email. `opportunityId` is stable
    // across a retry of the same delivery, so it doubles as the event id.
    eventId = req.header("x-idempotency-key") || String(opportunityId || "") || contentEventId(webhook);
    if (await hasBeenProcessed("phase1", eventId)) {
      console.log(`[Phase 1] Duplicate delivery for ${eventId}, skipping`);
      res.json({ success: true, duplicate: true });
      return;
    }
    try {
      await markProcessed("phase1", eventId);
    } catch {
      console.log(`[Phase 1] Concurrent delivery for ${eventId}, skipping`);
      res.json({ success: true, duplicate: true });
      return;
    }

    console.log(`[Phase 1] Starting provisioning for ${clientName} (${clientEmail})`);

    // Step 1: Clone GHL sub-account from template
    console.log("[Phase 1] Cloning GHL sub-account...");
    const templateLocationId = await findLocationByName("Template Do Not Delete");
    if (!templateLocationId) {
      throw new Error('Template account "Template Do Not Delete" not found');
    }

    const newLocationId = await cloneLocation(templateLocationId, clientName);
    console.log(`[Phase 1] Created GHL location: ${newLocationId}`);

    // Log event
    await logProvisioningEvent(newLocationId, {
      type: "phase1_started",
      timestamp: new Date(),
      details: { clientName, clientEmail, opportunityId },
    });

    // Step 2: Create Slack channel
    console.log("[Phase 1] Creating Slack channel...");
    const slackChannelId = await createSlackChannel(clientName);
    console.log(`[Phase 1] Created Slack channel: ${slackChannelId}`);

    // Step 3: Invite client to Slack as single-channel guest
    console.log("[Phase 1] Inviting client to Slack channel...");
    await inviteSlackGuest(slackChannelId, clientEmail);

    // Step 4: Create Drive folder
    console.log("[Phase 1] Creating Drive folder...");
    const sharedDriveId = process.env.TAG_SHARED_DRIVE_ID;
    if (!sharedDriveId) {
      throw new Error("TAG_SHARED_DRIVE_ID not set");
    }

    const driveFolderId = await createDriveFolder(sharedDriveId, clientName);
    console.log(`[Phase 1] Created Drive folder: ${driveFolderId}`);

    // Step 5: Add client email to OTP whitelist
    console.log("[Phase 1] Adding to OTP whitelist...");
    await addToOtpWhitelist(clientEmail);

    // Step 6: Create Fulfillment opportunity
    console.log("[Phase 1] Creating Fulfillment opportunity...");
    const pipelines = await getPipelines(newLocationId);
    const fulfillmentPipeline = pipelines.find((p) => p.name.includes("Fulfillment"));
    if (!fulfillmentPipeline) {
      throw new Error("Fulfillment pipeline not found in template account");
    }

    const fulfillmentOpportunityId = await createOpportunity(newLocationId, {
      pipelineId: fulfillmentPipeline.id,
      name: `${clientName} - Onboarding`,
      value: 0,
      status: "Appointment Scheduled",
    });
    console.log(`[Phase 1] Created Fulfillment opportunity: ${fulfillmentOpportunityId}`);

    // Step 7: Save tenant resources to Firestore
    console.log("[Phase 1] Saving to Firestore...");
    await saveTenantResources(newLocationId, {
      name: clientName,
      slackChannelId,
      driveFolderId,
      ownerEmail: clientEmail,
    });

    // Step 8: Email intake form to client
    // Note: Form URL comes from GHL agency account (already configured)
    console.log("[Phase 1] Sending intake form email...");
    const intakeFormUrl = `${process.env.GHL_FORM_URL}?email=${encodeURIComponent(clientEmail)}&locationId=${newLocationId}`;
    await sendIntakeFormEmail(clientEmail, clientName, intakeFormUrl);

    // Step 9: Notify TAG team
    await sendProvisioningConfirmation({
      clientName,
      clientEmail,
      locationId: newLocationId,
      slackChannelId,
      driveFolderId,
      opportunityId: fulfillmentOpportunityId,
    });

    // Log completion
    await logProvisioningEvent(newLocationId, {
      type: "phase1_complete",
      timestamp: new Date(),
      details: {
        slackChannelId,
        driveFolderId,
        fulfillmentOpportunityId,
      },
    });

    console.log(`[Phase 1] Complete for ${clientName}`);

    res.json({
      success: true,
      locationId: newLocationId,
      slackChannelId,
      driveFolderId,
    });
  } catch (error) {
    console.error("[Phase 1] Error:", error);
    // Provisioning didn't actually complete — release the claim so a retry
    // after the underlying issue is fixed isn't treated as a duplicate forever.
    if (eventId) {
      await clearProcessed("phase1", eventId).catch((clearError) => {
        console.error("[Phase 1] Failed to release idempotency claim:", clearError);
      });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
