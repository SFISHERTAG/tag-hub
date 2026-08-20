import "server-only";
import { getAdSpend } from "@/lib/meta/ads";
import { getTenant } from "@/lib/ghl/tenants";
import { getPipelines } from "@/lib/ghl/pipelines";
import { getOpportunities, type Opportunity } from "@/lib/ghl/opportunities";
import { getContact } from "@/lib/ghl/contacts";
import { GhlConfigError, LocationNotAuthorizedError } from "@/lib/ghl/tokens";

export type RoasRow = {
  adId: string;
  adName: string;
  spend: number;
  revenue: number;
  /**
   * `null` means "—": zero spend with conversions is undefined, not
   * Infinity (dev notes / AC6). Zero conversions with real spend is a
   * genuine 0.00 and stays a number.
   */
  roas: number | null;
  roas7d: number | null;
  roas30d: number | null;
  trend: "up" | "down" | "flat" | null;
};

export type RoasTableResult =
  | { ok: true; rows: RoasRow[] }
  | { ok: false; message: string };

function safeRoas(revenue: number, spend: number): number | null {
  if (spend === 0) return null;
  return revenue / spend;
}

function trendOf(shortTerm: number | null, longTerm: number | null): "up" | "down" | "flat" | null {
  if (shortTerm === null || longTerm === null) return null;
  if (shortTerm > longTerm) return "up";
  if (shortTerm < longTerm) return "down";
  return "flat";
}

/** Revenue per `utmAdId`, summed from won opportunities in the trailing `days` window. */
async function getRevenueByAd(locationId: string, days: number): Promise<Map<string, number>> {
  const pipelines = await getPipelines(locationId);
  const pipeline = pipelines[0];
  if (!pipeline) return new Map();

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const won: Opportunity[] = (await getOpportunities(locationId, pipeline.id, { status: "won" })).filter(
    (o) => {
      const changedMs = Date.parse(o.lastStageChangeAt ?? o.updatedAt);
      return !Number.isNaN(changedMs) && changedMs >= cutoffMs;
    },
  );

  const revenueByAd = new Map<string, number>();

  await Promise.all(
    won.map(async (opportunity) => {
      if (!opportunity.contact?.id) return;
      const contact = await getContact(locationId, opportunity.contact.id);
      const adId =
        contact?.attributionSource?.utmAdId ?? contact?.lastAttributionSource?.utmAdId;
      if (!adId) return;
      revenueByAd.set(adId, (revenueByAd.get(adId) ?? 0) + (opportunity.monetaryValue ?? 0));
    }),
  );

  return revenueByAd;
}

/**
 * Joins Story 4.2's per-ad spend to won-opportunity revenue on `utmAdId`
 * (Story 4.4). Revenue is real: `monetaryValue` only lands on an opportunity
 * once a CSM marks it won through `closeOpportunity` (Story 2.6), which
 * requires that value be set — there is no path to a won deal with a
 * fabricated or missing amount.
 */
export async function getAdRoas(locationId: string, days = 30): Promise<RoasTableResult> {
  try {
    const tenant = await getTenant(locationId);
    if (!tenant.metaAdAccountId) {
      return { ok: false, message: "No Meta ad account configured for this client." };
    }

    const [adSpend, revenue30d, revenue7d] = await Promise.all([
      getAdSpend(tenant.metaAdAccountId, days),
      getRevenueByAd(locationId, days),
      getRevenueByAd(locationId, 7),
    ]);

    if (adSpend.length === 0 && revenue30d.size === 0) {
      return { ok: true, rows: [] };
    }

    const spendById = new Map(adSpend.map((a) => [a.adId, a]));
    const adIds = new Set<string>([...spendById.keys(), ...revenue30d.keys()]);

    const rows: RoasRow[] = [...adIds].map((adId) => {
      const spendEntry = spendById.get(adId);
      const spend = spendEntry?.spend ?? 0;
      const spend7d = spendEntry?.spend7d ?? 0;
      const revenue = revenue30d.get(adId) ?? 0;
      const rev7d = revenue7d.get(adId) ?? 0;

      const roas30d = safeRoas(revenue, spend);
      const roas7d = safeRoas(rev7d, spend7d);

      return {
        adId,
        adName: spendEntry?.adName ?? adId,
        spend,
        revenue,
        roas: roas30d,
        roas7d,
        roas30d,
        trend: trendOf(roas7d, roas30d),
      };
    });

    // Nulls ("—") sort last — they aren't comparable to a real ROAS figure.
    rows.sort((a, b) => {
      if (a.roas === null && b.roas === null) return 0;
      if (a.roas === null) return 1;
      if (b.roas === null) return -1;
      return b.roas - a.roas;
    });

    return { ok: true, rows };
  } catch (error) {
    if (error instanceof GhlConfigError || error instanceof LocationNotAuthorizedError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Scoped to the caller's own tenant. `locationId` is resolved from the
 * session by the dashboard page (see lib/dashboard/location-selection.ts)
 * and access-checked there. These fetchers used to read a single global
 * `GHL_LOCATION_ID` env var instead, which meant every client tenant that
 * added this widget saw whichever location that var happened to point at.
 */
export async function getDashboardAdRoas(
  locationId: string,
  days = 30,
): Promise<RoasTableResult> {
  return getAdRoas(locationId, days);
}
