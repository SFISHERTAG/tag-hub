import { Request, Response } from "express";
import { createGoogleDoc, shareGoogleDoc, addDocTab } from "../google.js";
import { formatIntakeForDoc, unmappedKeys } from "../intake-format.js";
import { saveIntakeSubmission, logProvisioningEvent, saveTenantResources } from "../firestore.js";
import { generateAllContent } from "../gemini.js";
import { logAutomationEvent } from "../postgres.js";
import { hasBeenProcessed, claimEvent, clearProcessed, contentEventId } from "../lib/webhooks/idempotency.js";
import { checkWebhookSecret } from "../lib/webhooks/secret.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Phase 2: Intake form submission.
 *
 * Triggered when client submits the intake form.
 * Actions:
 * 1. Validate submission data
 * 2. Create Google Doc in client's Drive folder
 * 3. Seed with intake data
 * 4. Add empty tab for UVP (human will fill this)
 * 5. Share doc with client
 * 6. Log completion
 *
 * The human audit step (adding UVP copy, customization) happens outside this function.
 */
export async function handlePhase2(req: Request, res: Response): Promise<void> {
  checkWebhookSecret("Phase 2", req, "PHASE2_WEBHOOK_SECRET");

  let eventId: string | undefined;
  try {
    const { locationId, email, intakeData } = req.body;

    if (!locationId || !email || !intakeData) {
      res.status(400).json({
        error: "Missing required fields: locationId, email, intakeData",
      });
      return;
    }

    // This intake payload has no id of its own and the caller chain (client
    // form / GHL webhook / admin trigger, all proxied through the app) can
    // retry on a slow response — without a guard, the retry re-generates
    // Gemini content, re-creates the Google Doc, and re-shares it with the
    // client. Content hash catches an exact-body retry without blocking a
    // genuinely different later resubmission for the same location.
    eventId = req.header("x-idempotency-key") || contentEventId({ locationId, email, intakeData });
    if (await hasBeenProcessed("phase2", eventId)) {
      console.log(`[Phase 2] Duplicate delivery for ${eventId}, skipping`);
      res.json({ success: true, duplicate: true });
      return;
    }
    // Only a real ALREADY_EXISTS is a concurrent delivery. A Firestore
    // outage used to land here too and answer the sender "handled, duplicate",
    // which drops the event permanently: the sender stops retrying and
    // nothing ever processed it.
    if ((await claimEvent("phase2", eventId)) === "duplicate") {
      console.log(`[Phase 2] Concurrent delivery for ${eventId}, skipping`);
      res.json({ success: true, duplicate: true });
      return;
    }

    console.log(`[Phase 2] Processing intake submission for ${locationId}`);

    // Step 1: Save intake data to Firestore
    console.log("[Phase 2] Saving intake data...");
    await saveIntakeSubmission(locationId, intakeData);

    // Step 2: Get Drive folder ID from Firestore
    // (This was saved in Phase 1)
    const { Firestore } = await import("@google-cloud/firestore");
    const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
    const tenantDoc = await db.collection("locations").doc(locationId).get();
    const tenantData = tenantDoc.data();

    if (!tenantData?.driveFolderId) {
      throw new Error(`No Drive folder found for location ${locationId}`);
    }

    const driveFolderId = tenantData.driveFolderId;
    const clientName = tenantData.name;

    // Step 3: Generate UVP, ad copy, script, and project charter from intake data
    console.log("[Phase 2] Generating content with Gemini...");
    const generatedContent = await generateAllContent(intakeData);

    // Step 4: Create Google Doc with intake data
    console.log("[Phase 2] Creating Google Doc...");
    const docTitle = `${clientName} - Onboarding Doc`;

    // Format intake data for the doc.
    // Never `key: value` straight from the payload — this document is shared
    // with the client as reader, so a GHL slug key would be the first thing
    // they read. formatIntakeForDoc keeps every answer and shows no raw keys.
    const intakeFormatted = formatIntakeForDoc(intakeData);
    const unmapped = unmappedKeys(intakeData);
    if (unmapped.length > 0) {
      // Loud here, graceful in the document: these are the keys to add to
      // INTAKE_LABELS once the real payload shape is known.
      console.warn(`[Phase 2] Intake keys with no readable label: ${unmapped.join(", ")}`);
    }

    const initialContent = `${docTitle}\n\nSubmission Date: ${new Date().toISOString()}\n\nIntake Data:\n${intakeFormatted}`;

    const googleDocId = await createGoogleDoc(driveFolderId, docTitle, initialContent);
    console.log(`[Phase 2] Created Google Doc: ${googleDocId}`);

    // Step 5: Add all generated content as tabs/sections
    console.log("[Phase 2] Adding generated content sections...");

    // UVP
    await addDocTab(
      googleDocId,
      "UNIQUE VALUE PROPOSITION",
      generatedContent.uvp
    );

    // Ad Copy
    await addDocTab(
      googleDocId,
      "AD & VSL COPY",
      generatedContent.adCopy
    );

    // Pre-call Script
    await addDocTab(
      googleDocId,
      "PRE-CALL SCRIPT FOR CLOSERS",
      generatedContent.preCallScript
    );

    // Project Charter
    await addDocTab(
      googleDocId,
      "PROJECT CHARTER & TIMELINE",
      generatedContent.projectCharter
    );

    // Step 6: Share doc with client (read-only)
    console.log("[Phase 2] Sharing document with client...");
    await shareGoogleDoc(googleDocId, email, "reader");

    // Step 7: Update tenant record with doc ID
    //
    // Most new clients don't have a Meta ad account yet at this point —
    // funnel isn't even built (PR1). But some come in already running their
    // own Meta ads (e.g. Money Problems Solved), and if the intake form
    // captured that, this is what actually gets it onto the tenant record
    // rather than leaving it stranded inside the free-form intake blob.
    // Keys are read defensively since intakeData has no fixed schema (it's
    // JSON-dumped straight into Gemini prompts) — accepts either the
    // canonical camelCase field name or a plausible form-field alias.
    console.log("[Phase 2] Updating tenant record...");
    const readIntakeString = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const value = intakeData[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return undefined;
    };

    await saveTenantResources(locationId, {
      name: clientName,
      slackChannelId: tenantData.slackChannelId,
      driveFolderId,
      googleDocId,
      ownerEmail: email,
      metaAdAccountId: readIntakeString("metaAdAccountId", "meta_ad_account_id", "metaAdAccount"),
      metaBusinessId: readIntakeString("metaBusinessId", "meta_business_id", "metaBusinessManagerId"),
      metaPixelId: readIntakeString("metaPixelId", "meta_pixel_id"),
    });

    // Step 8: Log completion
    await logProvisioningEvent(locationId, {
      type: "phase2_complete",
      timestamp: new Date(),
      details: {
        googleDocId,
        intakeFields: Object.keys(intakeData),
        contentGenerated: ["uvp", "adCopy", "preCallScript", "projectCharter"],
      },
    });

    console.log(`[Phase 2] Complete for ${clientName}`);

    // Step 9: Trigger Phase 3 (Meta account setup)
    console.log("[Phase 2] Triggering Phase 3...");
    try {
      const slackChannelId = tenantData.slackChannelId;
      const phase3Url = process.env.PHASE3_WEBHOOK_URL ||
        `${process.env.CLOUD_FUNCTIONS_URL}/webhook/phase3`;

      if (!phase3Url) {
        throw new Error("PHASE3_WEBHOOK_URL or CLOUD_FUNCTIONS_URL not configured");
      }

      const phase3Response = await fetch(phase3Url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Phase 3 has the same at-least-once retry exposure; give it a
          // stable key up front rather than relying solely on its own
          // content hash of a body this call controls.
          "x-idempotency-key": contentEventId({ locationId, email, intakeData, slackChannelId }),
        },
        body: JSON.stringify({
          locationId,
          email,
          intakeData,
          slackChannelId,
        }),
      });

      const phase3Result: unknown = await phase3Response.json();
      const phase3ResultRecord = isRecord(phase3Result) ? phase3Result : undefined;

      if (!phase3Response.ok) {
        console.error("[Phase 2] Phase 3 trigger failed:", phase3Result);
        // Log but don't fail - Phase 3 can be triggered manually later
        await logAutomationEvent({
          locationId,
          phase: "phase2",
          event: "phase3_trigger_failed",
          status: "error",
          error: typeof phase3ResultRecord?.error === "string" ? phase3ResultRecord.error : undefined,
        });
      } else {
        console.log(`[Phase 2] Phase 3 triggered successfully:`, phase3Result);
        await logAutomationEvent({
          locationId,
          phase: "phase2",
          event: "phase3_triggered",
          status: "completed",
          details: phase3ResultRecord,
        });
      }
    } catch (phase3Error) {
      const error = phase3Error instanceof Error ? phase3Error.message : "Unknown error";
      console.error("[Phase 2] Failed to trigger Phase 3:", error);
      await logAutomationEvent({
        locationId,
        phase: "phase2",
        event: "phase3_trigger_error",
        status: "error",
        error,
      });
      // Continue anyway - Phase 3 can be triggered manually
    }

    res.json({
      success: true,
      googleDocId,
      status: "phase3_triggered",
      nextStep: "Phase 3 started: Meta account setup",
    });
  } catch (error) {
    console.error("[Phase 2] Error:", error);
    if (eventId) {
      await clearProcessed("phase2", eventId).catch((clearError) => {
        console.error("[Phase 2] Failed to release idempotency claim:", clearError);
      });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
