/*
 * The `import/no-restricted-paths` disable that used to sit here is gone: the
 * data path now runs through the `lib/data` repository seam (story 14.1), so
 * the zone no longer fires and eslint reported the directive as unused.
 *
 * The concern it recorded is NOT resolved and is kept here deliberately. This
 * still queries directly rather than going through a scoped metric fetch. Not
 * a leak today, since nothing here is per-user, but it is the pattern the zone
 * exists to stop. The remaining move is into lib/dashboard/metrics.ts.
 * See docs/ROLE_SCOPE_MODEL.md.
 */
import "server-only";
import { repository } from "@/lib/data";

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
  const data = await repository().locations.doc(locationId).get();
  if (!data) return {};

  return {
    slackChannelId:
      typeof data?.slackChannelId === "string" ? data.slackChannelId : undefined,
    driveFolderId:
      typeof data?.driveFolderId === "string" ? data.driveFolderId : undefined,
  };
}
