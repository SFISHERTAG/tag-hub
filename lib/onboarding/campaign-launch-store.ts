import "server-only";
import { createHash } from "node:crypto";
import { firestore } from "@/lib/firestore";
import type { CampaignFormInputs, PausedCampaign } from "./campaign-launch";
// (type-only import — no runtime circularity with campaign-launch.ts)

/**
 * Story 5.6 idempotency store. A launch is keyed by hash(locationId,
 * templateId, formInputs) so an accidental re-submit (double-click, a client
 * retrying a dropped response) resolves to the same document instead of
 * creating a second campaign.
 *
 * The document is written incrementally as each Meta resource is created —
 * not just once at the end — so a retry after a mid-way failure (campaign
 * created, ad set failed) resumes from the last completed step instead of
 * re-creating everything, per 5.6 AC4/5.
 */

export type CampaignLaunchState = {
  locationId: string;
  templateId: string;
  formInputs: CampaignFormInputs;
  adAccountId?: string;
  campaignId?: string;
  adSetId?: string;
  adIds?: string[];
  status: "in_progress" | "paused";
  createdAt: number;
  updatedAt: number;
};

const COLLECTION = (locationId: string) => `locations/${locationId}/campaignLaunches`;

export function campaignLaunchKey(
  locationId: string,
  templateId: string,
  formInputs: CampaignFormInputs,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ locationId, templateId, formInputs }))
    .digest("hex");
}

export async function getCampaignLaunchState(
  locationId: string,
  key: string,
): Promise<CampaignLaunchState | null> {
  const doc = await firestore().collection(COLLECTION(locationId)).doc(key).get();
  return doc.exists ? (doc.data() as CampaignLaunchState) : null;
}

/**
 * Firestore's `create()` fails if the document already exists, so two
 * concurrent launches with the same key race safely — exactly one create
 * succeeds and the loser reads back the winner's state instead of creating a
 * duplicate campaign.
 */
export async function reserveCampaignLaunch(
  locationId: string,
  key: string,
  templateId: string,
  formInputs: CampaignFormInputs,
): Promise<void> {
  const now = Date.now();
  await firestore()
    .collection(COLLECTION(locationId))
    .doc(key)
    .create({
      locationId,
      templateId,
      formInputs,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    } satisfies CampaignLaunchState);
}

export async function updateCampaignLaunch(
  locationId: string,
  key: string,
  patch: Partial<CampaignLaunchState>,
): Promise<void> {
  await firestore()
    .collection(COLLECTION(locationId))
    .doc(key)
    .set({ ...patch, updatedAt: Date.now() }, { merge: true });
}

export function toPausedCampaign(state: CampaignLaunchState): PausedCampaign {
  if (!state.campaignId || !state.adSetId || !state.adIds || state.status !== "paused") {
    throw new Error(
      `Campaign launch ${state.campaignId ?? "(no campaign yet)"} is still in progress — retry to resume it.`,
    );
  }
  return {
    campaignId: state.campaignId,
    adSetId: state.adSetId,
    adIds: state.adIds,
    status: "paused",
  };
}

/**
 * True if `campaignId` was launched from this location.
 *
 * Story 5.5's activation takes a caller-supplied campaign id and hands it
 * straight to Meta, where unpausing it starts real ad spend. The launch
 * store is already scoped per-location (`locations/{id}/campaignLaunches`),
 * so it is the record of which tenant a campaign belongs to — that makes
 * this the ownership check for a Meta campaign id.
 */
export async function locationOwnsCampaign(
  locationId: string,
  campaignId: string,
): Promise<boolean> {
  const snapshot = await firestore()
    .collection(COLLECTION(locationId))
    .where("campaignId", "==", campaignId)
    .limit(1)
    .get();
  return !snapshot.empty;
}
