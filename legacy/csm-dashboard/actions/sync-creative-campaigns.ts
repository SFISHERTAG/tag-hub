"use server";

import { firestore } from "@/lib/firestore";
import { getAdAccountCampaigns } from "@/lib/meta/campaigns";
import { getCreativesForCampaign } from "@/lib/meta/creatives";
import { requireCsmAccess } from "./access";
import type { CampaignRef } from "./get-creatives-with-campaigns";

/**
 * Sync creative-to-campaign mappings from Meta to Firestore.
 * For each campaign, fetches its ads and stores the relationship.
 */
export async function syncCreativeToCampaignMappings(clientId: string): Promise<void> {
  try {
    await requireCsmAccess();

    // Get client's Meta ad account ID
    const clientDoc = await firestore().collection("clients").doc(clientId).get();

    if (!clientDoc.exists) {
      console.warn(`Client ${clientId} not found`);
      return;
    }

    const data = clientDoc.data();
    const metaAdAccountId = data?.meta_ad_account_id;

    if (!metaAdAccountId) {
      console.warn(`Client ${clientId} has no Meta ad account ID configured`);
      return;
    }

    // Fetch all campaigns
    const campaignsResult = await getAdAccountCampaigns(metaAdAccountId);
    if (campaignsResult.error) {
      throw new Error(`Failed to fetch campaigns: ${campaignsResult.error.message}`);
    }
    const campaigns = campaignsResult.data;
    console.log(`Syncing ${campaigns.length} campaigns for client ${clientId}`);

    const db = firestore();
    const batch = db.batch();

    // For each campaign, fetch its creatives
    for (const campaign of campaigns) {
      const creativesResult = await getCreativesForCampaign(campaign.id);
      if (creativesResult.error) {
        throw new Error(`Failed to fetch creatives for campaign ${campaign.id}: ${creativesResult.error.message}`);
      }
      const creatives = creativesResult.data;
      console.log(`Campaign ${campaign.name} has ${creatives.length} creatives`);

      // Store each creative with its campaign reference
      for (const creative of creatives) {
        const creativeRef = db
          .collection("clients")
          .doc(clientId)
          .collection("meta_creatives")
          .doc(creative.id);

        // Get existing document to preserve other fields
        const existingDoc = await creativeRef.get();
        const existing = existingDoc.data() || {};

        // Build campaigns_using array, avoiding duplicates
        const campaigns_using: CampaignRef[] = existing.campaigns_using || [];
        const campaignIndex = campaigns_using.findIndex(
          (c) => c.campaignId === campaign.id,
        );

        if (campaignIndex >= 0) {
          campaigns_using[campaignIndex] = {
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: campaign.status,
          };
        } else {
          campaigns_using.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: campaign.status,
          });
        }

        // Update batch
        batch.set(
          creativeRef,
          {
            id: creative.id,
            name: creative.name,
            status: creative.status,
            effective_status: creative.effective_status,
            created_time: creative.created_time,
            adset_id: creative.adset_id,
            campaigns_using,
            last_synced: new Date().toISOString(),
          },
          { merge: true },
        );
      }
    }

    // Commit batch
    await batch.commit();
    console.log(`Synced creative-to-campaign mappings for client ${clientId}`);
  } catch (error) {
    console.error(`Error syncing creative-campaign mappings for client ${clientId}:`, error);
    throw error;
  }
}
