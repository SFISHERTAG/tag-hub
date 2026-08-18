"use server";

import { firestore } from "@/lib/firestore";
import { requireSession, requireLocationAccess } from "@/lib/auth/session";
import { fetchCreatives, type CreativeForDisplay } from "@/lib/dashboard/data-fetchers";

/**
 * Campaign reference for a creative.
 */
export interface CampaignRef {
  campaignId: string;
  campaignName: string;
  status: string;
}

/**
 * Creative with campaign references.
 */
export interface CreativeWithCampaigns extends CreativeForDisplay {
  campaigns_using?: CampaignRef[];
}

/**
 * Get creatives for a client with their campaign references.
 * Combines Google Drive creatives with Firestore Meta campaign data.
 */
export async function getCreativesWithCampaigns(
  clientId: string,
  locationId: string,
): Promise<CreativeWithCampaigns[]> {
  await requireSession();
  await requireLocationAccess(locationId);

  try {
    // Fetch creatives from Google Drive
    const creatives = await fetchCreatives(locationId);

    if (creatives.length === 0) {
      return [];
    }

    // Try to load Meta creative data with campaigns from Firestore
    const db = firestore();
    const metaCreativesRef = db
      .collection("clients")
      .doc(clientId)
      .collection("meta_creatives");

    const metaSnapshot = await metaCreativesRef.get();
    const metaCreativeMap = new Map<string, CampaignRef[]>();

    for (const doc of metaSnapshot.docs) {
      const data = doc.data();
      if (data.campaigns_using) {
        metaCreativeMap.set(doc.id, data.campaigns_using);
      }
    }

    // Enrich creatives with campaign data
    const enriched: CreativeWithCampaigns[] = creatives.map((creative) => ({
      ...creative,
      campaigns_using: metaCreativeMap.get(creative.id) || [],
    }));

    return enriched;
  } catch (error) {
    console.error(
      `Error fetching creatives with campaigns for client ${clientId}:`,
      error,
    );
    // Fallback to just returning creatives without campaign data
    const creatives = await fetchCreatives(locationId);
    return creatives.map((c) => ({ ...c, campaigns_using: [] }));
  }
}
