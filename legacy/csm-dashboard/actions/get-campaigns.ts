"use server";

import { firestore } from "@/lib/firestore";
import { getAdAccountCampaigns, type MetaCampaign } from "@/lib/meta/campaigns";
import { requireCsmAccess } from "./access";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server action to fetch campaigns for a client.
 * Gets the Meta ad account ID from Firestore, then fetches campaigns.
 */
export async function getCampaignsForClient(clientId: string): Promise<ApiResult<MetaCampaign[]>> {
  return withErrorHandling(`getCampaignsForClient(${clientId})`, async () => {
    await requireCsmAccess();

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
    return result.data;
  });
}
