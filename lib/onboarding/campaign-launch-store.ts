import "server-only";
import { createHash } from "node:crypto";
import { repository } from "@/lib/data";
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

const launches = (locationId: string) => repository().campaignLaunches(locationId);

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
  return launches(locationId).doc(key).get();
}

/**
 * Reserves the launch key. Two concurrent launches with the same key race
 * safely: exactly one reservation succeeds and the loser is rejected rather
 * than going on to create a second Meta campaign.
 *
 * **Throwing is the contract, not an implementation detail.** The only caller,
 * `createPausedCampaign`, does not wrap this call, and the statement after it
 * builds fresh `in_progress` state and proceeds to spend money at Meta. A
 * version of this that returned a boolean the caller ignored would turn a
 * refused reservation into a duplicate paid campaign. The repository seam
 * reports the collision as `false` rather than raising, so the throw is
 * re-established here deliberately.
 *
 * The previous comment claimed the loser "reads back the winner's state". It
 * does not, and never did — it throws. Recorded rather than quietly changed:
 * making the loser resume the winner's launch is a behaviour change, and 14.1
 * only moves call sites behind the seam.
 */
export async function reserveCampaignLaunch(
  locationId: string,
  key: string,
  templateId: string,
  formInputs: CampaignFormInputs,
): Promise<void> {
  const now = Date.now();
  // create(), not set(): a re-submit must resolve to the existing launch.
  // set() would let a second caller overwrite one already in progress.
  const reserved = await launches(locationId).doc(key).create({
    locationId,
    templateId,
    formInputs,
    status: "in_progress",
    createdAt: now,
    updatedAt: now,
  } satisfies CampaignLaunchState);

  if (!reserved) {
    throw new Error(
      `Campaign launch ${key} is already reserved for location ${locationId}. ` +
        "A concurrent launch with identical inputs won the reservation.",
    );
  }
}

export async function updateCampaignLaunch(
  locationId: string,
  key: string,
  patch: Partial<CampaignLaunchState>,
): Promise<void> {
  await launches(locationId)
    .doc(key)
    .set({ ...patch, updatedAt: Date.now() } as CampaignLaunchState, { merge: true });
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
