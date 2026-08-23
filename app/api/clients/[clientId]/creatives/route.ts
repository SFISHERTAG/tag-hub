/*
 * The `import/no-restricted-paths` disable that stood here is gone: the data
 * path now runs through the `lib/data` repository seam (story 14.1), so the
 * zone no longer fires and eslint reported the directive as unused.
 *
 * The concern it recorded is NOT resolved and is kept deliberately. This still
 * reads the meta_creatives subcollection directly for campaign-link badges, which is the pattern the zone exists to stop. The remaining move is
 * into lib/dashboard/metrics.ts. See docs/ROLE_SCOPE_MODEL.md.
 */
import { NextResponse } from "next/server";
import { repository } from "@/lib/data";
import { fetchCreatives, type CreativeForDisplay } from "@/lib/dashboard/data-fetchers";
import { handle, unwrap } from "../../../dashboard/_lib/http";
import { gateClient } from "../../_lib/gate";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/clients/[clientId]/creatives";

export type CampaignRef = { campaignId: string; campaignName: string; status: string };

export type CreativeWithCampaigns = CreativeForDisplay & { campaigns_using: CampaignRef[] };

export type ClientCreativesResponse = {
  clientId: string;
  /** Resolved server-side from the client record, echoed so the UI can link out. */
  locationId: string | null;
  creatives: CreativeWithCampaigns[];
  /** False when the campaign-link lookup failed; badges are then absent, not empty. */
  campaignLinksIncluded: boolean;
};

/**
 * GET /api/clients/[clientId]/creatives
 *
 * Port of legacy/csm-dashboard/actions/get-creatives-with-campaigns.ts.
 *
 * That action took `(clientId, locationId)` and the browser passed
 * `client.ghl_location_id` straight back from an object it had been handed —
 * a caller-supplied location id used to reach Google Drive with no check that
 * it belonged to the named client. Here the location is read from the client's
 * own record and the parameter is gone. This is the audit's caller-supplied-id
 * pattern, removed rather than re-checked: there is nothing to validate if the
 * caller never supplies it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const { clientId } = await params;

    // Role, then tenant. The role says "staff"; it never says which tenant.
    const gate = await gateClient(clientId, CONTEXT);
    if (!gate.ok) return gate.response;
    const { record } = gate;

    if (!record.ghlLocationId) {
      const body: ClientCreativesResponse = {
        clientId,
        locationId: null,
        creatives: [],
        campaignLinksIncluded: false,
      };
      return NextResponse.json(body);
    }

    // A real Drive failure fails the whole result rather than rendering an
    // empty list that looks like "this client has no creatives".
    const creatives = unwrap(await fetchCreatives(record.ghlLocationId));

    if (creatives.length === 0) {
      const body: ClientCreativesResponse = {
        clientId,
        locationId: record.ghlLocationId,
        creatives: [],
        campaignLinksIncluded: true,
      };
      return NextResponse.json(body);
    }

    // Campaign-link enrichment is supplementary: if this fails the creatives
    // still render, just without campaign badges. `campaignLinksIncluded`
    // tells the UI which of "no campaigns" and "we could not tell" it has.
    const links = new Map<string, CampaignRef[]>();
    let campaignLinksIncluded = true;
    try {
      const found = await repository().clientMetaCreatives(clientId).list();
      for (const { id, data } of found) {
        const campaigns = data.campaigns_using;
        if (Array.isArray(campaigns)) links.set(id, campaigns as CampaignRef[]);
      }
    } catch (error) {
      console.error(`[GET /api/clients/${clientId}/creatives] campaign links unavailable:`, error);
      campaignLinksIncluded = false;
    }

    const body: ClientCreativesResponse = {
      clientId,
      locationId: record.ghlLocationId,
      creatives: creatives.map((creative) => ({
        ...creative,
        campaigns_using: links.get(creative.id) ?? [],
      })),
      campaignLinksIncluded,
    };
    return NextResponse.json(body);
  });
}
