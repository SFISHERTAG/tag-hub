"use server";

import { firestore } from "@/lib/firestore";
import { requireSession, requireLocationAccess } from "@/lib/auth/session";
import { getAdAccountCampaigns } from "@/lib/meta/campaigns";
import { getCreativesForCampaign } from "@/lib/meta/creatives";
import { getClientLocationId } from "@/lib/dashboard/csm-clients";

/**
 * Sync creative-to-campaign mappings from Meta to Firestore.
 * For each campaign, fetches its ads and stores the relationship.
 */
export async function syncCreativeToCampaignMappings(clientId: string): Promise<void> {
  await requireSession();

  const locationId = await getClientLocationId(clientId);
  if (!locationId) {
    throw new Error(`Client ${clientId} not found`);
  }
  await requireLocationAccess(locationId);

  try {
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
    const campaigns = await getAdAccountCampaigns(metaAdAccountId);
    console.log(`Syncing ${campaigns.length} campaigns for client ${clientId}`);

    const db = firestore();
    const batch = db.batch();

    // For each campaign, fetch its creatives
    for (const campaign of campaigns) {
      const creatives = await getCreativesForCampaign(campaign.id);
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
        const campaigns_using = existing.campaigns_using || [];
        const campaignIndex = campaigns_using.findIndex(
          (c: any) => c.campaignId === campaign.id,
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
