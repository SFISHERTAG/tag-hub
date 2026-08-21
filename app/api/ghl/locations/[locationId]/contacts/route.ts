import "server-only";
import type { NextRequest } from "next/server";
import { searchContacts, type Contact } from "@/lib/ghl/contacts";
import { displayName } from "@/lib/ghl/format";
import { gateLocation } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson, readLimit } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/ghl/locations/[locationId]/contacts";

const DEFAULT_LIMIT = 50;
/** GHL's own per-request ceiling on this endpoint. */
const MAX_LIMIT = 100;
const MAX_QUERY = 200;

/** A contact with its display name already resolved. The fallback chain
 * (contactName, then first+last, then email, then "Unnamed") lives in
 * lib/ghl/format.ts and is not worth a second implementation in Angular. */
export type ContactSummary = Contact & { displayName: string };

export type ContactsResponse = {
  query: string | null;
  limit: number;
  contacts: ContactSummary[];
  /** The page was full, so there are probably more. GHL returns no total here. */
  truncated: boolean;
};

/**
 * GET /api/ghl/locations/[locationId]/contacts?q=&limit=
 *
 * The `q` search is passed to GHL, which matches name, email, and phone.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const gate = await gateLocation(locationId, CONTEXT);
  if (!gate.ok) return gate.response;

  const search = request.nextUrl.searchParams;

  const limit = readLimit(search.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  if (limit === null) {
    return badRequest(CONTEXT, `limit must be a whole number from 1 to ${MAX_LIMIT}.`);
  }

  const rawQuery = search.get("q")?.trim() ?? "";
  if (rawQuery.length > MAX_QUERY) {
    return badRequest(CONTEXT, `q must be ${MAX_QUERY} characters or fewer.`);
  }
  const query = rawQuery === "" ? null : rawQuery;

  return ghlJson<ContactsResponse>(CONTEXT, async () => {
    const found = await searchContacts(locationId, {
      query: query ?? undefined,
      limit,
    });

    return {
      query,
      limit,
      contacts: found.map((contact) => ({ ...contact, displayName: displayName(contact) })),
      truncated: found.length >= limit,
    };
  });
}
