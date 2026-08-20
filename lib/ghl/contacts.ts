import "server-only";
import { ghl } from "./client";

export type Contact = {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  dateUpdated?: string;
  /** Present on the list endpoint. */
  attributions?: Attribution[];
  /** Present on the single-contact endpoint — first touch. */
  attributionSource?: Attribution;
  /** Present on the single-contact endpoint — most recent touch. */
  lastAttributionSource?: Attribution;
};

/**
 * Where a contact came from. `utmAdId` is the one that matters most — it
 * attributes revenue to an individual ad rather than a campaign, which is what
 * makes per-creative ROAS possible.
 */
export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmAdId?: string;
  utmFbclid?: string;
  fbc?: string;
  fbp?: string;
  referrer?: string;
  pageUrl?: string;
  medium?: string;
  /** Alternate names used by the single-contact endpoint. */
  sessionSource?: string;
  campaign?: string;
  url?: string;
};

export type Note = {
  id: string;
  body: string;
  userId?: string;
  dateAdded?: string;
};

/**
 * Attribution arrives under different shapes depending on the endpoint: the
 * list returns an `attributions` array, the single-contact route returns
 * `attributionSource` and `lastAttributionSource` objects. Normalising here
 * keeps that inconsistency out of every caller.
 *
 * First and last touch are kept apart on purpose — one names the ad that found
 * the lead, the other the ad that brought them back. Attributing revenue to
 * either alone misreads which creative is doing the work.
 */


export function hasMetaIdentifiers(attribution: Attribution | undefined): boolean {
  return Boolean(attribution?.fbc || attribution?.fbp || attribution?.utmFbclid);
}


type ContactListResponse = {
  contacts?: Contact[];
  meta?: {
    total?: number;
    nextPageUrl?: string | null;
    startAfter?: number | null;
    startAfterId?: string | null;
  };
};

/** GHL's own per-request ceiling on this endpoint. */
const CONTACTS_PAGE_SIZE = 100;

export async function searchContacts(
  locationId: string,
  options: { query?: string; limit?: number } = {},
): Promise<Contact[]> {
  const { query, limit = 50 } = options;

  const data = await ghl<ContactListResponse>(locationId, "/contacts/", {
    searchParams: {
      locationId,
      limit,
      ...(query ? { query } : {}),
    },
  });

  return data.contacts ?? [];
}

export type ContactPage = {
  contacts: Contact[];
  /** True if the cap was hit with more pages still available. */
  truncated: boolean;
};

/**
 * Every contact added since `sinceMs`, following GHL's cursor.
 *
 * `searchContacts` returns one page and no more. Callers that need a
 * complete set over a time window were passing `limit: 100` and filtering
 * client-side, which quietly produced a wrong answer above 100 contacts:
 * whichever page GHL happened to return got filtered down, and the result
 * was reported as a successful, complete count.
 *
 * This pages until it sees a contact older than the window, or runs out of
 * pages, or hits `maxPages`. That last case is the one that matters: the
 * cap is real, so it is reported rather than silently applied. A caller that
 * gets `truncated: true` is holding an undercount and has to say so.
 *
 * The stop-on-older-contact check assumes GHL's default newest-first
 * ordering. If a page arrives out of order, the worst case is extra pages
 * fetched, not a wrong result: filtering by `dateAdded` happens over
 * everything collected regardless.
 */
export async function listContactsAddedSince(
  locationId: string,
  sinceMs: number,
  options: { maxPages?: number } = {},
): Promise<ContactPage> {
  const { maxPages = 20 } = options;

  const collected: Contact[] = [];
  const seenIds = new Set<string>();
  let startAfter: number | null | undefined;
  let startAfterId: string | null | undefined;

  for (let page = 0; page < maxPages; page++) {
    const data = await ghl<ContactListResponse>(locationId, "/contacts/", {
      searchParams: {
        locationId,
        limit: CONTACTS_PAGE_SIZE,
        ...(startAfter != null ? { startAfter } : {}),
        ...(startAfterId != null ? { startAfterId } : {}),
      },
    });

    const batch = data.contacts ?? [];
    if (batch.length === 0) return { contacts: collected, truncated: false };

    let reachedWindowEdge = false;
    for (const contact of batch) {
      // A cursor that fails to advance would otherwise loop until maxPages
      // and double-count everything it re-read.
      if (seenIds.has(contact.id)) continue;
      seenIds.add(contact.id);

      const addedMs = Date.parse(contact.dateAdded ?? "");
      if (!Number.isNaN(addedMs) && addedMs < sinceMs) {
        reachedWindowEdge = true;
        continue;
      }
      collected.push(contact);
    }

    if (reachedWindowEdge) return { contacts: collected, truncated: false };

    const next = data.meta;
    startAfter = next?.startAfter;
    startAfterId = next?.startAfterId;
    if (startAfter == null && startAfterId == null) {
      return { contacts: collected, truncated: false };
    }
  }

  return { contacts: collected, truncated: true };
}

export async function getContact(
  locationId: string,
  contactId: string,
): Promise<Contact | null> {
  const data = await ghl<{ contact?: Contact }>(
    locationId,
    `/contacts/${contactId}`,
  );
  return data.contact ?? null;
}

export async function getNotes(
  locationId: string,
  contactId: string,
): Promise<Note[]> {
  const data = await ghl<{ notes?: Note[] }>(
    locationId,
    `/contacts/${contactId}/notes`,
  );

  return (data.notes ?? []).sort((a, b) => {
    const left = Date.parse(a.dateAdded ?? "");
    const right = Date.parse(b.dateAdded ?? "");
    if (Number.isNaN(left) || Number.isNaN(right)) return 0;
    return right - left; // newest first
  });
}

export async function addNote(
  locationId: string,
  contactId: string,
  body: string,
): Promise<void> {
  await ghl(locationId, `/contacts/${contactId}/notes`, {
    method: "POST",
    body: { body },
  });
}


// Re-exported so existing server-side callers keep their import path.
export { firstTouch, lastTouch, displayName, formatDate } from "./format";
