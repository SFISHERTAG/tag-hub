import "server-only";
import { getMetaApi, isMetaConfigured } from "./client";

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
 * Returns empty array if Meta is not configured.
 */
export async function getAdAccountCampaigns(adAccountId: string): Promise<MetaCampaign[]> {
  if (!isMetaConfigured()) {
    console.warn("Meta not configured - returning empty campaigns");
    return [];
  }

  try {
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
  } catch (error) {
    console.error(`Failed to fetch campaigns for ${adAccountId}:`, error);
    return [];
  }
}

/**
 * Get metrics for a single campaign (last 24 hours or date range).
 */
async function getCampaignMetrics(campaignId: string, datePreset: string): Promise<MetaCampaignMetrics> {
  try {
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
  } catch (error) {
    console.error(`Failed to fetch metrics for campaign ${campaignId}:`, error);
    return { spend: 0, impressions: 0, clicks: 0, conversions: 0, leads: 0, roas: 0 };
  }
}

/**
 * Get a single campaign's full details.
 */
export async function getCampaignDetail(campaignId: string): Promise<MetaCampaign | null> {
  if (!isMetaConfigured()) return null;

  try {
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
  } catch (error) {
    console.error(`Failed to fetch campaign ${campaignId}:`, error);
    return null;
  }
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
