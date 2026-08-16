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


export async function searchContacts(
  locationId: string,
  options: { query?: string; limit?: number } = {},
): Promise<Contact[]> {
  const { query, limit = 50 } = options;

  const data = await ghl<{ contacts?: Contact[] }>(locationId, "/contacts/", {
    searchParams: {
      locationId,
      limit,
      ...(query ? { query } : {}),
    },
  });

  return data.contacts ?? [];
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
