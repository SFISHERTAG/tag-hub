/*
 * The `import/no-restricted-paths` disable that stood here is gone: the data
 * path now runs through the `lib/data` repository seam (story 14.1), so the
 * zone no longer fires and eslint reported the directive as unused.
 *
 * The concern it recorded is NOT resolved and is kept deliberately. This still
 * queries directly instead of going through a scoped metric fetch, which is the pattern the zone exists to stop. The remaining move is
 * into lib/dashboard/metrics.ts. See docs/ROLE_SCOPE_MODEL.md.
 */
import "server-only";
import { repository } from "@/lib/data";
import { searchContacts } from "@/lib/ghl/contacts";
import { getLastMetaFetch } from "@/lib/meta/fetch-log";

/**
 * The "as of" timestamp for a client's dashboard: the most recent of three
 * independent signals. GHL contacts and appointment outcomes are always
 * live queries, so their freshness is really about how recently something
 * happened, not staleness. Meta is different — its data can be up to 24h
 * delayed, and its responses carry no timestamp of their own, which is why
 * that source alone needs a server-recorded fetch time (lib/meta/fetch-log.ts).
 */

export type FreshnessSource = "appointment_outcome" | "contact_added" | "meta_fetch";

export type LastUpdated = {
  timestamp: number | null;
  source: FreshnessSource | null;
};

async function getLastOutcomeMarkedAt(locationId: string): Promise<number | null> {
  const [latest] = await repository().appointmentOutcomes(locationId).list({
    orderBy: { field: "markedAt", direction: "desc" },
    limit: 1,
  });
  return latest?.data.markedAt ?? null;
}

async function getLastContactAddedAt(locationId: string): Promise<number | null> {
  // GHL's contact list endpoint has no server-side sort by dateAdded, so this
  // scans the most recent page rather than guaranteeing the true max across
  // every contact. Good enough for a freshness signal, not a precise query.
  const contacts = await searchContacts(locationId, { limit: 100 });

  let max: number | null = null;
  for (const contact of contacts) {
    const parsed = Date.parse(contact.dateAdded ?? "");
    if (!Number.isNaN(parsed) && (max === null || parsed > max)) max = parsed;
  }
  return max;
}

export async function getLastUpdated(locationId: string): Promise<LastUpdated> {
  const [outcomeAt, contactAt, metaAt] = await Promise.all([
    getLastOutcomeMarkedAt(locationId).catch(() => null),
    getLastContactAddedAt(locationId).catch(() => null),
    getLastMetaFetch(locationId).catch(() => null),
  ]);

  const candidates: Array<{ timestamp: number; source: FreshnessSource }> = [];
  if (outcomeAt !== null) candidates.push({ timestamp: outcomeAt, source: "appointment_outcome" });
  if (contactAt !== null) candidates.push({ timestamp: contactAt, source: "contact_added" });
  if (metaAt !== null) candidates.push({ timestamp: metaAt, source: "meta_fetch" });

  if (candidates.length === 0) return { timestamp: null, source: null };

  return candidates.reduce((latest, candidate) =>
    candidate.timestamp > latest.timestamp ? candidate : latest,
  );
}
