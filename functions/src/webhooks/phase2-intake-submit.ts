import { Request, Response } from "express";
import { createGoogleDoc, shareGoogleDoc, addDocTab } from "../google";
import { saveIntakeSubmission, logProvisioningEvent, saveTenantResources } from "../firestore";
import { generateAllContent } from "../gemini";

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
  try {
    const { locationId, email, intakeData } = req.body;

    if (!locationId || !email || !intakeData) {
      res.status(400).json({
        error: "Missing required fields: locationId, email, intakeData",
      });
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

    // Format intake data for the doc
    const intakeFormatted = Object.entries(intakeData)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

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
    console.log("[Phase 2] Updating tenant record...");
    await saveTenantResources(locationId, {
      name: clientName,
      slackChannelId: tenantData.slackChannelId,
      driveFolderId,
      googleDocId,
      ownerEmail: email,
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

    res.json({
      success: true,
      googleDocId,
      status: "awaiting_human_audit",
      nextStep: "Human review: add UVP copy and customize document",
    });
  } catch (error) {
    console.error("[Phase 2] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
