import "server-only";
import { getMetaApi, isMetaConfigured, MetaApiError } from "./client";

/**
 * Meta ad-level spend (Story 4.2).
 * Fetches spend per individual ad, not per campaign — Story 4.4's ROAS join
 * needs per-ad numbers since GHL only attributes revenue down to `utmAdId`.
 */
export interface AdSpend {
  adId: string;
  adName: string;
  /** Spend over the full `days` window. */
  spend: number;
  /** Spend over the trailing 7 days, for the 7-day-vs-30-day trend (AC2). */
  spend7d: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function timeRange(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  return { since: isoDate(since), until: isoDate(until) };
}

async function fetchAdInsights(
  api: ReturnType<typeof getMetaApi>,
  accountPath: string,
  days: number,
): Promise<Map<string, { adName: string; spend: number }>> {
  const response = (
    await api.call<{ data: any[] }>("GET", `/${accountPath}/insights`, {
      level: "ad",
      fields: ["ad_id", "ad_name", "spend"],
      time_range: timeRange(days),
      limit: 500,
    })
  ).data;

  const byAd = new Map<string, { adName: string; spend: number }>();
  for (const row of response ?? []) {
    byAd.set(row.ad_id, { adName: row.ad_name, spend: parseFloat(row.spend) || 0 });
  }
  return byAd;
}

/**
 * Fetch spend per ad for the last `days` days, plus a trailing-7-day figure
 * for trend comparisons. Returns an empty array if Meta isn't configured at
 * the app level (missing env vars) — callers that already gate on the
 * tenant's `metaAdAccountId` (Story 4.2 AC5) treat that as "nothing to
 * show" rather than an error.
 *
 * Throws MetaApiError if the call itself fails, rather than swallowing it
 * into `[]` — a caller can't tell "this ad account has no spend" from "Meta
 * rejected the request" if both come back as an empty array, and Story 4.2's
 * error-handling requirement needs that distinction to show a clear message
 * instead of a blank table.
 */
export async function getAdSpend(adAccountId: string, days = 30): Promise<AdSpend[]> {
  if (!isMetaConfigured()) return [];

  const api = getMetaApi();
  const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  let thirtyDay: Map<string, { adName: string; spend: number }>;
  let sevenDay: Map<string, { adName: string; spend: number }>;
  try {
    [thirtyDay, sevenDay] = await Promise.all([
      fetchAdInsights(api, accountPath, days),
      fetchAdInsights(api, accountPath, 7),
    ]);
  } catch (error) {
    throw new MetaApiError(`/${accountPath}/insights`, error);
  }

  const adIds = new Set([...thirtyDay.keys(), ...sevenDay.keys()]);

  return [...adIds].map((adId) => {
    const full = thirtyDay.get(adId);
    const recent = sevenDay.get(adId);
    return {
      adId,
      adName: full?.adName ?? recent?.adName ?? adId,
      spend: full?.spend ?? 0,
      spend7d: recent?.spend ?? 0,
    };
  });
}
