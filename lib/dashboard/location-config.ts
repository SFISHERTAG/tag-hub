import "server-only";
import { firestore } from "@/lib/firestore";

/**
 * Per-location extras the client-owner dashboard needs — things GHL has no
 * concept of, so they live in Firestore per the data boundary in
 * architecture.md.
 *
 * Both fields are provisioned outside this module today: `driveFolderId` by
 * whatever creates a client's Shared Drive subfolder, `slackChannelId` by
 * whoever adds the client as a single-channel guest. Absent means "not set up
 * yet" for that client, not an error — the dashboard widgets render a
 * not-configured state rather than fail.
 */
export type LocationConfig = {
  slackChannelId?: string;
  driveFolderId?: string;
};

export async function getLocationConfig(
  locationId: string,
): Promise<LocationConfig> {
  const snapshot = await firestore().doc(`locations/${locationId}`).get();
  if (!snapshot.exists) return {};

  const data = snapshot.data();
  return {
    slackChannelId:
      typeof data?.slackChannelId === "string" ? data.slackChannelId : undefined,
    driveFolderId:
      typeof data?.driveFolderId === "string" ? data.driveFolderId : undefined,
  };
}
