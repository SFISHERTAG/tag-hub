import { Request, Response } from "express";
import { saveTenantResources, logProvisioningEvent } from "../firestore";
import { sendMetaAccessRequest, sendMetaSetupGuide } from "../email";
import { postMessage } from "../slack";
import { logAutomationEvent, logMetaSetup } from "../postgres";

/**
 * Phase 3: Meta Ad Account Setup (triggered after intake form submission).
 *
 * Actions:
 * 1. Check if client provided Meta ad account ID in intake
 * 2. If they have account: Request system user access
 * 3. If they don't: Send setup guide + create request ticket
 * 4. Update location config with Meta details (if provided)
 * 5. Notify TAG team & client via Slack
 *
 * Triggered by: Phase 2 intake submission webhook
 * Next: Awaiting human verification of Meta access grant
 */
export async function handlePhase3(req: Request, res: Response): Promise<void> {
  try {
    const { locationId, email, intakeData, slackChannelId } = req.body;

    if (!locationId || !email || !intakeData) {
      res.status(400).json({
        error: "Missing required fields: locationId, email, intakeData",
      });
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
      // Step 2a: Client has Meta account - request system user access
      console.log("[Phase 3] Requesting system user access...");

      const systemUserId = process.env.META_SYSTEM_USER_ID;
      const tagTeamEmail = process.env.TAG_TEAM_EMAIL || "team@taxadvisorygrowth.net";

      if (!systemUserId) {
        throw new Error("META_SYSTEM_USER_ID not configured");
      }

      // Email client with access request instructions
      await sendMetaAccessRequest(email, {
        clientName: intakeData.clientName,
        metaAdAccountId,
        systemUserId,
        instructions: getMetaAccessInstructions(metaAdAccountId, systemUserId),
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
          systemUserId,
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
                text: `*Meta Account Setup*\n✅ Client has Meta ad account\n\n*Account ID:* ${metaAdAccountId}\n*Status:* Awaiting access grant from client\n\n_System user access request sent to: ${email}_`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Next step:* Client grants system user (${systemUserId}) access to their Meta ad account`,
              },
            },
          ],
        });
      }

      // Log completion
      await logProvisioningEvent(locationId, {
        type: "phase3_access_requested",
        timestamp: new Date(),
        details: { metaAdAccountId, systemUserId },
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

    // Log error to Postgres
    await logAutomationEvent({
      locationId,
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
 * Generate instructions for granting system user access to Meta ad account.
 */
function getMetaAccessInstructions(
  metaAdAccountId: string,
  systemUserId: string,
): string {
  return `
To grant our system user access to your Meta ad account (${metaAdAccountId}):

1. Go to https://business.facebook.com
2. Click Settings → Users and Permissions
3. Click "Admin" for the system user ${systemUserId}
4. Grant access to your ad account (${metaAdAccountId})
5. Reply to this email confirming access is granted

Our system will then automatically configure your account for campaign management and reporting.
`;
}
