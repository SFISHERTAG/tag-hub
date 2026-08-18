import "server-only";
import { getAdSpend } from "@/lib/meta/ads";
import { getTenant } from "@/lib/ghl/tenants";
import { recordMetaFetch } from "@/lib/meta/fetch-log";
import { MetaApiError } from "@/lib/meta/client";

export type AdSpendRow = {
  adId: string;
  adName: string;
  spend: number;
  startDate: string;
  endDate: string;
  /** 7-day avg spend vs the `days`-window avg — AC2's ↑/↓ arrow. */
  trend: "up" | "down" | "flat";
};

export type AdSpendTableResult =
  | { ok: true; rows: AdSpendRow[] }
  | { ok: false; message: string; reason: "not_set_up" | "error" };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Story 4.2: spend per ad for a client's Meta ad account, last `days` days,
 * sorted by spend descending, with a 7-day-vs-window-avg trend arrow.
 *
 * Mirrors getAdRoas's result shape (lib/dashboard/roas.ts, Story 4.4) —
 * same "not set up" vs generic-error split, since both stories hang off the
 * same Story 4.1 dependency and the same AC5 requirement.
 */
export async function getAdSpendTable(locationId: string, days = 30): Promise<AdSpendTableResult> {
  const tenant = await getTenant(locationId);
  if (!tenant.metaAdAccountId) {
    return {
      ok: false,
      reason: "not_set_up",
      message: "This client isn't connected to a Meta ad account yet.",
    };
  }

  let ads;
  try {
    ads = await getAdSpend(tenant.metaAdAccountId, days);
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message:
        error instanceof MetaApiError
          ? error.message
          : `Failed to fetch spend from Meta: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  await recordMetaFetch(locationId).catch(() => {});

  const until = isoDate(new Date());
  const since = isoDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const trendWindow = Math.min(7, days);

  const rows: AdSpendRow[] = ads
    .map((ad) => {
      const avgWindow = ad.spend / days;
      const avg7 = ad.spend7d / trendWindow;
      const trend: AdSpendRow["trend"] =
        avgWindow === 0 ? "flat" : avg7 > avgWindow * 1.05 ? "up" : avg7 < avgWindow * 0.95 ? "down" : "flat";

      return {
        adId: ad.adId,
        adName: ad.adName,
        spend: ad.spend,
        startDate: since,
        endDate: until,
        trend,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  return { ok: true, rows };
}
