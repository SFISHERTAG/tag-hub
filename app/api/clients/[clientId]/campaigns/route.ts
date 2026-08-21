import { NextResponse, type NextRequest } from "next/server";
import {
  getAdAccountCampaigns,
  getCampaignCreativeCount,
  type MetaCampaign,
} from "@/lib/meta/campaigns";
import { handle, unwrap } from "../../../dashboard/_lib/http";
import { gateClient } from "../../_lib/gate";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/clients/[clientId]/campaigns";

export type CampaignWithCreativeCount = MetaCampaign & { creative_count: number };

export type ClientCampaignsResponse = {
  clientId: string;
  /** Null when the client has no Meta ad account configured — an expected state, not a failure. */
  metaAdAccountId: string | null;
  campaigns: CampaignWithCreativeCount[];
  /** True when `creative_count` was populated. False means every count is 0 and means nothing. */
  creativeCountsIncluded: boolean;
};

/**
 * GET /api/clients/[clientId]/campaigns?withCreativeCounts=true
 *
 * Ports both legacy/csm-dashboard/actions/get-campaigns.ts and
 * get-campaigns-with-creatives.ts — they differed only by whether each campaign
 * was enriched with a creative count, which is one extra Meta call per campaign
 * and so stays opt-in.
 *
 * The Meta ad account id is read from the client's own Firestore record. The
 * caller supplies a clientId and nothing else; there is no way to point this
 * at an ad account the record does not name.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const { clientId } = await params;

    // Role, then tenant. The role says "staff"; it never says which tenant.
    const gate = await gateClient(clientId, CONTEXT);
    if (!gate.ok) return gate.response;
    const { record } = gate;

    if (!record.metaAdAccountId) {
      const body: ClientCampaignsResponse = {
        clientId,
        metaAdAccountId: null,
        campaigns: [],
        creativeCountsIncluded: false,
      };
      return NextResponse.json(body);
    }

    const campaigns = unwrap(await getAdAccountCampaigns(record.metaAdAccountId));

    const withCounts = request.nextUrl.searchParams.get("withCreativeCounts") === "true";
    const enriched: CampaignWithCreativeCount[] = withCounts
      ? await Promise.all(
          campaigns.map(async (campaign) => ({
            ...campaign,
            creative_count: await getCampaignCreativeCount(campaign.id),
          })),
        )
      : campaigns.map((campaign) => ({ ...campaign, creative_count: 0 }));

    const body: ClientCampaignsResponse = {
      clientId,
      metaAdAccountId: record.metaAdAccountId,
      campaigns: enriched,
      creativeCountsIncluded: withCounts,
    };
    return NextResponse.json(body);
  });
}
