import "server-only";
import { requireSession, requireOwnedLocation, ForbiddenError } from "@/lib/auth/session";
import { unpauseCampaign } from "@/lib/meta/campaigns";
import { updateOpportunityStage } from "@/lib/ghl/opportunities";
import { findStageId } from "@/lib/ghl/pipelines";
import { getMetaApi, isMetaConfigured, MetaApiError, MetaNotConfiguredError } from "@/lib/meta/client";
import { logAction } from "@/lib/audit/store";
import { getCampaignTemplate } from "./campaign-templates";
import { getMaxMonthlyBudget } from "./offer-budgets";
import { getTenant } from "@/lib/ghl/tenants";
import {
  campaignLaunchKey,
  getCampaignLaunchState,
  locationOwnsCampaign,
  reserveCampaignLaunch,
  updateCampaignLaunch,
  toPausedCampaign,
} from "./campaign-launch-store";

/**
 * Form inputs collected by CampaignLaunchForm (Story 5.2). This shape is the
 * contract with `createPausedCampaign` (Story 5.4) — keep field names in
 * sync since 5.4 is the only place that reads them.
 */
export type CampaignFormInputs = {
  clientName: string;
  offerId: string;
  monthlyBudget: number;
  dailyCap: number;
  pixelId: string;
};

export type PausedCampaign = {
  campaignId: string;
  adSetId: string;
  adIds: string[];
  status: "paused";
};

type RawCampaignFormInputs = {
  client: string;
  offer: string;
  budget: string;
  cap: string;
  pixel: string;
};

type ParseResult =
  | { ok: true; value: CampaignFormInputs }
  | { ok: false; error: string };

/**
 * Validates and coerces the raw string form/query values shared between the
 * launch form (5.2) and the preview page (5.3) into `CampaignFormInputs`.
 * Single source of truth for the AC4 validation rules (5.2) so the two
 * pages and the server action can't drift out of sync with each other.
 */
export function parseCampaignFormInputs(raw: RawCampaignFormInputs): ParseResult {
  const clientName = raw.client.trim();
  const offerId = raw.offer.trim();
  const pixelId = raw.pixel.trim();
  const monthlyBudget = Number(raw.budget);
  const dailyCap = Number(raw.cap);

  if (!clientName) return { ok: false, error: "Client name is required." };
  if (!offerId || !getCampaignTemplate(offerId)) return { ok: false, error: "Select an offer." };
  if (!pixelId) return { ok: false, error: "GHL conversion pixel ID is required." };
  if (!Number.isFinite(monthlyBudget) || monthlyBudget < 100) {
    return { ok: false, error: "Monthly budget must be at least $100." };
  }
  if (!Number.isFinite(dailyCap) || dailyCap <= 0) {
    return { ok: false, error: "Daily cap is required." };
  }
  if (dailyCap > monthlyBudget / 30) {
    return { ok: false, error: "Daily cap can't exceed monthly budget ÷ 30." };
  }

  return { ok: true, value: { clientName, offerId, monthlyBudget, dailyCap, pixelId } };
}

/**
 * Single call site for campaign creation, per Story 5.4's acceptance
 * criteria. The launch form (5.2) hands off here instead of creating the
 * campaign itself, so 5.6's idempotency guard has exactly one place to
 * protect.
 *
 * Every created resource lands in Meta already paused — nothing here ever
 * spends money. Story 5.5 is the only place that flips status to active.
 *
 * Idempotent (Story 5.6): a retry with the same (locationId, templateId,
 * formInputs) resumes an in-progress launch or returns the already-completed
 * one, instead of duplicating campaigns on a double-click or network retry.
 */
export async function createPausedCampaign(
  locationId: string | null,
  templateId: string,
  formInputs: CampaignFormInputs,
): Promise<PausedCampaign> {
  if (!locationId) {
    throw new Error(
      "No client selected — launch a campaign from within a client's account (via impersonation) " +
        "so creation can target that client's Meta ad account and audit log.",
    );
  }

  // Creation targets the tenant's Meta ad account and writes their audit
  // log, so the location has to be the caller's before any of that starts.
  await requireOwnedLocation(locationId);

  const template = getCampaignTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown campaign template "${templateId}" — check the offer list in campaign-templates.ts.`);
  }

  const maxBudget = getMaxMonthlyBudget(templateId);
  if (maxBudget !== undefined && formInputs.monthlyBudget > maxBudget) {
    throw new Error(
      `Budget issue: $${formInputs.monthlyBudget}/mo exceeds the $${maxBudget}/mo ceiling for "${template.offerLabel}".`,
    );
  }

  if (!isMetaConfigured()) {
    throw new Error(
      "Meta Marketing API is not configured — Story 4.1's System User setup must complete before campaigns can be created.",
    );
  }

  const tenant = await getTenant(locationId);
  if (!tenant.metaAdAccountId) {
    throw new Error(
      `No Meta ad account is configured for this client (locationId ${locationId}) — ` +
        "set metaAdAccountId on the tenant record before launching a campaign.",
    );
  }
  const adAccountId = tenant.metaAdAccountId.startsWith("act_")
    ? tenant.metaAdAccountId
    : `act_${tenant.metaAdAccountId}`;

  const key = campaignLaunchKey(locationId, templateId, formInputs);
  let state = await getCampaignLaunchState(locationId, key);

  if (state?.status === "paused") {
    // Already completed by a prior call with identical inputs — return it
    // as-is rather than touching Meta again.
    return toPausedCampaign(state);
  }

  if (!state) {
    await reserveCampaignLaunch(locationId, key, templateId, formInputs);
    state = {
      locationId,
      templateId,
      formInputs,
      adAccountId,
      status: "in_progress",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const api = getMetaApi();

  try {
    let campaignId = state.campaignId;
    if (!campaignId) {
      campaignId = await createCampaign(api, adAccountId, formInputs, template.offerLabel);
      await updateCampaignLaunch(locationId, key, { campaignId, adAccountId });
    }

    let adSetId = state.adSetId;
    if (!adSetId) {
      adSetId = await createAdSet(api, adAccountId, campaignId, formInputs, template.adSetTargeting);
      await updateCampaignLaunch(locationId, key, { adSetId });
    }

    let adIds = state.adIds;
    if (!adIds) {
      adIds = await createAds(api, adAccountId, adSetId, template.creatives, formInputs);
      await updateCampaignLaunch(locationId, key, { adIds, status: "paused" });
    } else if (state.status !== "paused") {
      await updateCampaignLaunch(locationId, key, { status: "paused" });
    }

    const result: PausedCampaign = { campaignId, adSetId, adIds, status: "paused" };

    await logAction(locationId, {
      actorId: "system:campaign-launch",
      actorRole: "system",
      action: "campaign.create",
      targetType: "campaign",
      targetId: campaignId,
      metadata: {
        adAccountId,
        adSetId,
        adIds,
        templateId,
        offerLabel: template.offerLabel,
        clientName: formInputs.clientName,
        monthlyBudget: formInputs.monthlyBudget,
        dailyCap: formInputs.dailyCap,
        pixelId: formInputs.pixelId,
        idempotencyKey: key,
      },
    });

    return result;
  } catch (error) {
    throw toActionableError(error, template.offerLabel);
  }
}

async function createCampaign(
  api: ReturnType<typeof getMetaApi>,
  adAccountId: string,
  formInputs: CampaignFormInputs,
  offerLabel: string,
): Promise<string> {
  const response = await api.call<{ id: string }>("POST", `/${adAccountId}/campaigns`, {
    name: `${formInputs.clientName} — ${offerLabel}`,
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: [],
  });
  return response.id;
}

async function createAdSet(
  api: ReturnType<typeof getMetaApi>,
  adAccountId: string,
  campaignId: string,
  formInputs: CampaignFormInputs,
  targeting: string,
): Promise<string> {
  const response = await api.call<{ id: string }>("POST", `/${adAccountId}/adsets`, {
    name: `${formInputs.clientName} — ad set`,
    campaign_id: campaignId,
    daily_budget: Math.round(formInputs.dailyCap * 100), // Meta expects cents
    billing_event: "IMPRESSIONS",
    optimization_goal: "OFFSITE_CONVERSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    promoted_object: { pixel_id: formInputs.pixelId, custom_event_type: "LEAD" },
    targeting: { description: targeting },
    status: "PAUSED",
  });
  return response.id;
}

async function createAds(
  api: ReturnType<typeof getMetaApi>,
  adAccountId: string,
  adSetId: string,
  creatives: { id: string }[],
  formInputs: CampaignFormInputs,
): Promise<string[]> {
  const adIds: string[] = [];
  for (const creative of creatives) {
    const response = await api.call<{ id: string }>("POST", `/${adAccountId}/ads`, {
      name: `${formInputs.clientName} — ${creative.id}`,
      adset_id: adSetId,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    adIds.push(response.id);
  }
  return adIds;
}

/**
 * Meta's errors come back as opaque HTTP failures via MetaApiError. Callers
 * (the server action, eventually the preview UI) need to tell a CSM what to
 * actually fix, not just "creation failed" — so pattern-match the common
 * cases the Marketing API returns.
 */
function toActionableError(error: unknown, offerLabel: string): Error {
  if (error instanceof MetaNotConfiguredError) return error;

  const message = error instanceof MetaApiError ? String(error.cause ?? error.message) : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("pixel")) {
    return new Error(`Invalid pixel ID for "${offerLabel}" — check the GHL conversion pixel ID and try again.`);
  }
  if (lower.includes("oauth") || lower.includes("token") || lower.includes("permission") || lower.includes("auth")) {
    return new Error(
      "Meta authentication failed — the System User token may have been revoked or lost ad account access.",
    );
  }
  if (lower.includes("budget") || lower.includes("spend cap") || lower.includes("insufficient funds")) {
    return new Error(`Budget issue creating "${offerLabel}" campaign: ${message}`);
  }

  return new Error(`Campaign creation failed for "${offerLabel}": ${message}`);
}

/** Fulfillment pipeline stage this story advances the opportunity to. */
export const AP2_STAGE_NAME = "AP 2 - Ads Launched";

export type ActivationResult = {
  campaignId: string;
  opportunityId: string;
  stageId: string;
  stageName: string;
};

/**
 * Single call site for Story 5.5: unpause the campaign in Meta, then advance
 * the Fulfillment opportunity to `AP 2 - Ads Launched`, then record an audit
 * log entry. Meta and GHL don't share a transaction, so this can't be truly
 * atomic — and "rolling back" by re-pausing the campaign after a GHL failure
 * would just be a second fallible network call layered on the first, which
 * can compound the inconsistency instead of resolving it. So the order is
 * fixed (unpause, then stage update) and a GHL failure after a successful
 * unpause throws an error that says so explicitly: the campaign IS live and
 * only the stage move needs a retry, so the CSM never has to guess which
 * side of the operation actually happened.
 */
export async function activateCampaign(
  locationId: string,
  campaignId: string,
  opportunityId: string,
): Promise<ActivationResult> {
  const session = await requireSession();

  // This is the one call in the codebase that starts real ad spend, and both
  // ids reaching it are caller-supplied. A campaign id is not a secret — it
  // shows up in URLs and support tickets — so without these two checks a CSM
  // who has seen another client's campaign id can switch on that client's
  // budget without their consent.
  await requireOwnedLocation(locationId);
  if (!(await locationOwnsCampaign(locationId, campaignId))) {
    throw new ForbiddenError(
      `Campaign ${campaignId} was not launched from location ${locationId} — refusing to activate it.`,
    );
  }

  await unpauseCampaign(campaignId);

  const stageId = await findStageId(locationId, AP2_STAGE_NAME);
  if (!stageId) {
    throw new Error(
      `Campaign ${campaignId} is now LIVE on Meta, but the "${AP2_STAGE_NAME}" pipeline stage ` +
        `could not be found for this location — the Fulfillment stage was NOT updated. ` +
        `Move opportunity ${opportunityId} to that stage manually once the stage exists.`,
    );
  }

  try {
    await updateOpportunityStage(locationId, opportunityId, stageId);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Campaign ${campaignId} is now LIVE on Meta, but updating the Fulfillment stage failed: ${cause}. ` +
        `Do not relaunch the campaign — retry moving opportunity ${opportunityId} to ` +
        `"${AP2_STAGE_NAME}" manually.`,
    );
  }

  await logAction(locationId, {
    actorId: session.uid,
    actorRole: session.currentRole,
    action: "campaign.activate",
    targetType: "opportunity",
    targetId: opportunityId,
    metadata: { campaignId, stageId, stageName: AP2_STAGE_NAME },
  });

  return { campaignId, opportunityId, stageId, stageName: AP2_STAGE_NAME };
}
