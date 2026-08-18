"use server";

import { firestore } from "@/lib/firestore";
import { getAdAccountCampaigns, type MetaCampaign, getCampaignCreativeCount } from "@/lib/meta/campaigns";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Campaign with creative count for dashboard display.
 */
export interface CampaignWithCreativeCount extends MetaCampaign {
  creative_count: number;
}

/**
 * Server action to fetch campaigns for a client with creative counts.
 */
export async function getCampaignsWithCreativesForClient(
  clientId: string,
): Promise<ApiResult<CampaignWithCreativeCount[]>> {
  return withErrorHandling(`getCampaignsWithCreativesForClient(${clientId})`, async () => {
    // Get client's Meta ad account ID from Firestore
    const clientDoc = await firestore().collection("clients").doc(clientId).get();

    if (!clientDoc.exists) {
      console.warn(`Client ${clientId} not found`);
      return [];
    }

    const data = clientDoc.data();
    const metaAdAccountId = data?.meta_ad_account_id;

    if (!metaAdAccountId) {
      console.warn(`Client ${clientId} has no Meta ad account ID configured`);
      return [];
    }

    // Fetch campaigns from Meta
    const result = await getAdAccountCampaigns(metaAdAccountId);
    if (result.error) throw new Error(result.error.message);

    // Enrich each campaign with creative count
    return Promise.all(
      result.data.map(async (campaign) => ({
        ...campaign,
        creative_count: await getCampaignCreativeCount(campaign.id),
      })),
    );
  });
}
