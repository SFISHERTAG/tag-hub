import "server-only";
import { getMetaApi, isMetaConfigured, MetaApiError } from "./client";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Meta campaigns data for CSM dashboard.
 * Fetches active campaigns for a given ad account.
 */

export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  spend_24h: number;
  impressions_24h: number;
  clicks_24h: number;
  leads_24h: number;
  roas_24h?: number;
  start_date?: string;
  end_date?: string;
  created_time: string;
}

export interface MetaCampaignMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  roas: number;
}

/**
 * Fetch all active campaigns for an ad account.
 * `data: []` (no `error`) if Meta is not configured — that's an expected
 * state, not a failure. A failed API call is `error !== null` instead of a
 * silently empty/zeroed list, so a revoked token renders as "error loading
 * campaigns," not "$0 spend."
 */
export async function getAdAccountCampaigns(adAccountId: string): Promise<ApiResult<MetaCampaign[]>> {
  if (!isMetaConfigured()) {
    console.warn("Meta not configured - returning empty campaigns");
    return { data: [], error: null };
  }

  return withErrorHandling(`getAdAccountCampaigns(${adAccountId})`, async () => {
    const api = getMetaApi();

    // Format: "act_123456" for ad account ID
    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    const response = (
      await api.call<{ data: any[] }>(
        "GET",
        `/${accountPath}/campaigns`,
        {
          fields: [
            "id",
            "name",
            "status",
            "created_time",
            "start_date",
            "end_date",
            "daily_budget",
            "lifetime_budget",
          ],
          limit: 100,
        },
      )
    ).data;

    const campaigns: MetaCampaign[] = [];

    for (const campaign of response) {
      // Deliberately not caught per-campaign: a metrics fetch failing partway
      // through would otherwise render some campaigns with real spend next to
      // others silently zeroed, which reads as "this campaign spent $0" —
      // indistinguishable from the truth. One failure fails the whole list.
      const metrics = await getCampaignMetrics(campaign.id, "last_24h");

      campaigns.push({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        spend_24h: metrics.spend,
        impressions_24h: metrics.impressions,
        clicks_24h: metrics.clicks,
        leads_24h: metrics.leads,
        roas_24h: metrics.conversions > 0 ? metrics.spend / metrics.conversions : undefined,
        created_time: campaign.created_time,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
      });
    }

    return campaigns.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());
  });
}

/**
 * Get metrics for a single campaign (last 24 hours or date range). Throws on
 * failure rather than returning zeroed metrics — see the caller-level note
 * on why a partial failure shouldn't render as real, if unlucky, data.
 */
async function getCampaignMetrics(campaignId: string, datePreset: string): Promise<MetaCampaignMetrics> {
  const api = getMetaApi();

  const response = (
    await api.call<{ data: any[] }>(
      "GET",
      `/${campaignId}/insights`,
      {
        fields: ["spend", "impressions", "clicks", "conversions", "lead_generation_by_ad_id"],
        date_preset: datePreset,
      },
    )
  ).data;

  if (!response || response.length === 0) {
    return { spend: 0, impressions: 0, clicks: 0, conversions: 0, leads: 0, roas: 0 };
  }

  const data = response[0];

  return {
    spend: parseFloat(data.spend) || 0,
    impressions: parseInt(data.impressions) || 0,
    clicks: parseInt(data.clicks) || 0,
    conversions: parseInt(data.conversions) || 0,
    leads: data.lead_generation_by_ad_id
      ? Object.values(data.lead_generation_by_ad_id as Record<string, number>).reduce((a, b) => a + b, 0)
      : 0,
    roas: data.conversions > 0 ? parseFloat(data.spend) / parseInt(data.conversions) : 0,
  };
}

/**
 * Get a single campaign's full details. `data: null, error: null` if Meta
 * isn't configured (expected); `data: null, error !== null` on a failed call.
 */
export async function getCampaignDetail(campaignId: string): Promise<ApiResult<MetaCampaign | null>> {
  if (!isMetaConfigured()) return { data: null, error: null };

  return withErrorHandling(`getCampaignDetail(${campaignId})`, async () => {
    const api = getMetaApi();

    const response = await api.call<any>(
      "GET",
      `/${campaignId}`,
      {
        fields: [
          "id",
          "name",
          "status",
          "created_time",
          "start_date",
          "end_date",
          "objective",
          "special_ad_categories",
        ],
      },
    );

    const metrics = await getCampaignMetrics(campaignId, "last_24h");

    return {
      id: response.id,
      name: response.name,
      status: response.status,
      spend_24h: metrics.spend,
      impressions_24h: metrics.impressions,
      clicks_24h: metrics.clicks,
      leads_24h: metrics.leads,
      roas_24h: metrics.roas,
      created_time: response.created_time,
      start_date: response.start_date,
      end_date: response.end_date,
    };
  });
}

/**
 * Unpause a campaign (Story 5.5). No isMetaConfigured() short-circuit here,
 * unlike the read helpers above — a caller activating a real campaign needs
 * a thrown MetaApiError/MetaNotConfiguredError, not a silently-ignored no-op.
 */
export async function unpauseCampaign(campaignId: string): Promise<{ status: "ACTIVE" }> {
  const api = getMetaApi();

  try {
    await api.call<any>("POST", `/${campaignId}`, { status: "ACTIVE" });
  } catch (error) {
    throw new MetaApiError(`/${campaignId}`, error);
  }

  return { status: "ACTIVE" };
}

/**
 * Get count of ads (creatives) in a campaign.
 * Used to show "X creatives" badge on campaigns.
 */
export async function getCampaignCreativeCount(campaignId: string): Promise<number> {
  if (!isMetaConfigured()) return 0;

  try {
    const api = getMetaApi();

    const response = (
      await api.call<{ data: any[] }>(
        "GET",
        `/${campaignId}/ads`,
        {
          fields: ["id"],
          limit: 1000,
        },
      )
    ).data;

    return response ? response.length : 0;
  } catch (error) {
    console.error(`Failed to fetch creative count for campaign ${campaignId}:`, error);
    return 0;
  }
}
