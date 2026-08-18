import "server-only";
import { getMetaApi, isMetaConfigured } from "./client";

/**
 * Meta creatives (ads) data for CSM dashboard.
 * Fetches ads for campaigns and maps them to local creatives.
 */

export interface MetaCreative {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  created_time: string;
  effective_status?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
}

export interface CreativeCampaignLink {
  campaignId: string;
  campaignName: string;
  status: string;
}

/**
 * Fetch all ads (creatives) for a campaign.
 * Returns empty array if Meta is not configured.
 */
export async function getCreativesForCampaign(campaignId: string): Promise<MetaCreative[]> {
  if (!isMetaConfigured()) {
    console.warn("Meta not configured - returning empty creatives");
    return [];
  }

  try {
    const api = getMetaApi();

    const response = (
      await api.call<{ data: any[] }>(
        "GET",
        `/${campaignId}/ads`,
        {
          fields: [
            "id",
            "name",
            "status",
            "effective_status",
            "created_time",
            "adset_id",
            "campaign_id",
          ],
          limit: 100,
        },
      )
    ).data;

    const creatives: MetaCreative[] = [];

    for (const ad of response) {
      creatives.push({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        created_time: ad.created_time,
        effective_status: ad.effective_status,
        adset_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        campaign_name: "", // Will be filled in by caller with campaign name
      });
    }

    return creatives.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());
  } catch (error) {
    console.error(`Failed to fetch creatives for campaign ${campaignId}:`, error);
    return [];
  }
}

/**
 * Fetch creative details by ID from Meta.
 */
export async function getCreativeDetail(creativeId: string): Promise<MetaCreative | null> {
  if (!isMetaConfigured()) return null;

  try {
    const api = getMetaApi();

    const response = await api.call<any>(
      "GET",
      `/${creativeId}`,
      {
        fields: [
          "id",
          "name",
          "status",
          "effective_status",
          "created_time",
          "adset_id",
          "campaign_id",
          "body",
          "object_story_spec",
        ],
      },
    );

    return {
      id: response.id,
      name: response.name,
      status: response.status,
      created_time: response.created_time,
      effective_status: response.effective_status,
      adset_id: response.adset_id,
      campaign_id: response.campaign_id,
    };
  } catch (error) {
    console.error(`Failed to fetch creative ${creativeId}:`, error);
    return null;
  }
}

/**
 * Map creatives from Meta to a campaign-link structure.
 * Used to populate campaigns_using array in Firestore.
 */
export function mapCreativesToCampaignLinks(
  creatives: MetaCreative[],
  campaignId: string,
  campaignName: string,
  campaignStatus: string,
): CreativeCampaignLink[] {
  return creatives.map(() => ({
    campaignId,
    campaignName,
    status: campaignStatus,
  }));
}
