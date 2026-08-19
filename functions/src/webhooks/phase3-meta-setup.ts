import { Request, Response } from "express";
import { saveTenantResources, logProvisioningEvent } from "../firestore";
import { sendMetaAccessRequest, sendMetaSetupGuide } from "../email";
import { postMessage } from "../slack";
import { logAutomationEvent, logMetaSetup } from "../postgres";
import { hasBeenProcessed, markProcessed, clearProcessed, contentEventId } from "../lib/webhooks/idempotency";
import { checkWebhookSecret } from "../lib/webhooks/secret";

/**
 * Phase 3: Meta Ad Account Setup (triggered after intake form submission).
 *
 * Actions:
 * 1. Check if client provided Meta ad account ID in intake
 * 2. If they have account: Request Business Manager Admin access for
 *    support@taxadvisorygrowth.net (see docs/meta-live-launch-plan.md,
 *    "Phase 2.5" — no Partner/business-to-business sharing for any client
 *    onboarded from 2026-08-19 forward; TAG creates the System User itself,
 *    inside the client's own Business Manager, once granted Admin access)
 * 3. If they don't: Send setup guide + create request ticket
 * 4. Update location config with Meta details (if provided)
 * 5. Notify TAG team & client via Slack
 *
 * Triggered by: Phase 2 intake submission webhook
 * Next: Awaiting human verification of Meta access grant
 */
export async function handlePhase3(req: Request, res: Response): Promise<void> {
  // Phase 3 has no caller sending a bearer token yet (neither Phase 2's own
  // auto-trigger nor app/api/onboarding/phase3-meta-setup do) — this just
  // makes that visible in logs rather than validating anything real today.
  checkWebhookSecret("Phase 3", req, "PHASE3_WEBHOOK_SECRET");

  // Hoisted so the catch block below can reference them — they were
  // previously `const`-declared inside the try, which made the catch
  // block's `logAutomationEvent({ locationId, ... })` throw a
  // ReferenceError on every single failure instead of logging one.
  let locationId: string | undefined;
  let eventId: string | undefined;
  try {
    const { email, intakeData, slackChannelId } = req.body;
    locationId = req.body.locationId;

    if (!locationId || !email || !intakeData) {
      res.status(400).json({
        error: "Missing required fields: locationId, email, intakeData",
      });
      return;
    }

    // Phase 3 is reachable both from Phase 2's own auto-trigger and from
    // app/api/onboarding/phase3-meta-setup's manual trigger, either of which
    // can retry on a slow response — without a guard, the retry re-sends
    // the client-facing access-request or setup-guide email.
    eventId = req.header("x-idempotency-key") || contentEventId({ locationId, email, intakeData, slackChannelId });
    if (await hasBeenProcessed("phase3", eventId)) {
      console.log(`[Phase 3] Duplicate delivery for ${eventId}, skipping`);
      res.json({ success: true, duplicate: true });
      return;
    }
    try {
      await markProcessed("phase3", eventId);
    } catch {
      console.log(`[Phase 3] Concurrent delivery for ${eventId}, skipping`);
      res.json({ success: true, duplicate: true });
      return;
    }

    console.log(`[Phase 3] Starting Meta setup for ${locationId}`);

    // Log to Postgres
    await logAutomationEvent({
      locationId,
      phase: "phase3",
      event: "phase3_started",
      status: "started",
      metadata: { email },
    });

    // Step 1: Extract Meta account info from intake
    const metaAdAccountId = intakeData.metaAdAccountId || intakeData.meta_ad_account_id;
    const metaBusinessId = intakeData.metaBusinessId || intakeData.meta_business_id;
    const hasMetaAccount = Boolean(metaAdAccountId);

    console.log(`[Phase 3] Client has Meta account: ${hasMetaAccount}`);

    // Log event
    await logProvisioningEvent(locationId, {
      type: "phase3_started",
      timestamp: new Date(),
      details: { hasMetaAccount, metaAdAccountId },
    });

    // Log to Postgres
    await logAutomationEvent({
      locationId,
      phase: "phase3",
      event: "meta_account_check",
      status: "completed",
      details: { hasMetaAccount, metaAdAccountId },
    });

    if (hasMetaAccount) {
      // Step 2a: Client has Meta account - request Business Manager Admin
      // access (see docs/meta-live-launch-plan.md, "Phase 2.5" — no Partner
      // sharing; TAG creates the System User inside the client's own
      // Business Manager once granted Admin, so there's no TAG-owned system
      // user id to hand the client here).
      console.log("[Phase 3] Requesting Business Manager Admin access...");

      const tagAccessEmail = process.env.TAG_META_ACCESS_EMAIL || "support@taxadvisorygrowth.net";
      const tagTeamEmail = process.env.TAG_TEAM_EMAIL || "team@taxadvisorygrowth.net";

      // Email client with access request instructions
      await sendMetaAccessRequest(email, {
        clientName: intakeData.clientName,
        metaAdAccountId,
        tagAccessEmail,
        instructions: getMetaAccessInstructions(metaAdAccountId, tagAccessEmail),
      });

      console.log("[Phase 3] Meta access request email sent to client");

      // Log to Postgres
      await logAutomationEvent({
        locationId,
        phase: "phase3",
        event: "meta_access_request_sent",
        status: "completed",
        details: {
          metaAdAccountId,
          tagAccessEmail,
          clientEmail: email,
        },
      });

      // Update location with Meta account info (pending verification)
      await saveTenantResources(locationId, {
        metaAdAccountId,
        metaBusinessId,
        metaSetupStatus: "awaiting_access_grant",
        metaAccessRequestedAt: new Date().toISOString(),
      });

      // Notify TAG team
      if (slackChannelId) {
        await postMessage(slackChannelId, {
          text: `📱 Meta Account Setup - Access Requested`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Meta Account Setup*\n✅ Client has Meta ad account\n\n*Account ID:* ${metaAdAccountId}\n*Status:* Awaiting Business Manager Admin grant from client\n\n_Access request sent to: ${email}_`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Next step:* Client adds ${tagAccessEmail} as a Business Manager Admin. Once granted, TAG creates the System User inside the client's Business Manager directly (docs/meta-live-launch-plan.md, Phase 2.5).`,
              },
            },
          ],
        });
      }

      // Log completion
      await logProvisioningEvent(locationId, {
        type: "phase3_access_requested",
        timestamp: new Date(),
        details: { metaAdAccountId, tagAccessEmail },
      });

      res.json({
        success: true,
        status: "access_requested",
        nextStep: "Awaiting client to grant system user access",
        metaAdAccountId,
      });
    } else {
      // Step 2b: Client doesn't have Meta account - send setup guide
      console.log("[Phase 3] Sending Meta setup guide...");

      // Email setup guide
      await sendMetaSetupGuide(email, {
        clientName: intakeData.clientName,
        setupUrl: `${process.env.META_SETUP_GUIDE_URL || "https://facebook.com/ads/manager/setup"}`,
        supportEmail: process.env.TAG_TEAM_EMAIL || "support@taxadvisorygrowth.net",
      });

      console.log("[Phase 3] Meta setup guide sent to client");

      // Log to Postgres
      await logAutomationEvent({
        locationId,
        phase: "phase3",
        event: "meta_setup_guide_sent",
        status: "completed",
        details: {
          clientEmail: email,
          setupUrl: process.env.META_SETUP_GUIDE_URL,
        },
      });

      // Update location with pending status
      await saveTenantResources(locationId, {
        metaSetupStatus: "awaiting_account_creation",
        metaSetupGuidesentAt: new Date().toISOString(),
      });

      // Notify TAG team via Slack
      if (slackChannelId) {
        await postMessage(slackChannelId, {
          text: `📱 Meta Account Setup - Creating New Account`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Meta Account Setup*\n⚠️ Client does not have Meta ad account yet\n\n*Status:* Setup guide sent to client\n*Email:* ${email}`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Next step:* Client creates Meta ad account and provides account ID\n*Support:* ${process.env.TAG_TEAM_EMAIL}`,
              },
            },
          ],
        });
      }

      // Log completion
      await logProvisioningEvent(locationId, {
        type: "phase3_setup_guide_sent",
        timestamp: new Date(),
        details: { email },
      });

      res.json({
        success: true,
        status: "setup_guide_sent",
        nextStep: "Awaiting client to create Meta account and provide account ID",
      });
    }

    console.log(`[Phase 3] Complete for ${locationId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Phase 3] Error:", error);

    if (eventId) {
      await clearProcessed("phase3", eventId).catch((clearError) => {
        console.error("[Phase 3] Failed to release idempotency claim:", clearError);
      });
    }

    // Log error to Postgres
    await logAutomationEvent({
      locationId: locationId ?? "unknown",
      phase: "phase3",
      event: "phase3_error",
      status: "error",
      error: errorMessage,
    });

    res.status(500).json({
      error: errorMessage,
    });
  }
}

/**
 * Generate instructions for granting Business Manager Admin access.
 *
 * We do not use Meta's Partner (business-to-business) sharing for any
 * client — see docs/meta-live-launch-plan.md, "Phase 2.5". TAG creates the
 * System User itself, inside the client's own Business Manager, once
 * granted Admin — there's no existing TAG-owned system user id to hand the
 * client here.
 */
function getMetaAccessInstructions(
  metaAdAccountId: string,
  tagAccessEmail: string,
): string {
  return `
To give TAG access to manage your Meta ad account (${metaAdAccountId}):

1. Go to https://business.facebook.com
2. Click Business Settings → Users → People → Add
3. Add ${tagAccessEmail} as a Business Manager Admin (not just access to one ad account — full Business Manager Admin)
4. Reply to this email confirming access is granted

From there, we handle the rest ourselves — no further action needed on your end. Our system will then be configured for campaign management and reporting.
`;
}
