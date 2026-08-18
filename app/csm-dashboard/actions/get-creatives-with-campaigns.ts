"use server";

import { firestore } from "@/lib/firestore";
import { fetchCreatives, type CreativeForDisplay } from "@/lib/dashboard/data-fetchers";
import { type ApiResult } from "@/lib/api/errorInterceptor";

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
): Promise<ApiResult<CreativeWithCampaigns[]>> {
  // Fetch creatives from Google Drive — a real failure here (not "no files")
  // fails the whole result rather than rendering an empty/misleading list.
  const creativesResult = await fetchCreatives(locationId);
  if (creativesResult.error) return { data: null, error: creativesResult.error };
  const creatives = creativesResult.data;

  if (creatives.length === 0) {
    return { data: [], error: null };
  }

  // Campaign-link enrichment is supplementary — if Firestore fails here, the
  // creatives themselves still render, just without campaign badges.
  const metaCreativeMap = new Map<string, CampaignRef[]>();
  try {
    const db = firestore();
    const metaCreativesRef = db
      .collection("clients")
      .doc(clientId)
      .collection("meta_creatives");

    const metaSnapshot = await metaCreativesRef.get();
    for (const doc of metaSnapshot.docs) {
      const data = doc.data();
      if (data.campaigns_using) {
        metaCreativeMap.set(doc.id, data.campaigns_using);
      }
    }
  } catch (error) {
    console.error(`Error loading campaign links for client ${clientId}:`, error);
  }

  return {
    data: creatives.map((creative) => ({
      ...creative,
      campaigns_using: metaCreativeMap.get(creative.id) || [],
    })),
    error: null,
  };
}
