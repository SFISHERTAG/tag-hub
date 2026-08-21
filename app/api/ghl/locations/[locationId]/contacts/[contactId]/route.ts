import "server-only";
import {
  getContact,
  getNotes,
  hasMetaIdentifiers,
  type Attribution,
  type Contact,
  type Note,
} from "@/lib/ghl/contacts";
import { displayName, firstTouch, lastTouch } from "@/lib/ghl/format";
import { gateLocationAndId } from "@/app/api/ghl/_lib/gate";
import { ResourceNotFoundError, ghlJson } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/ghl/locations/[locationId]/contacts/[contactId]";

export type ContactDetailResponse = {
  contact: Contact & { displayName: string };
  notes: Note[];
  /**
   * Attribution arrives under different shapes depending on the GHL endpoint.
   * `firstTouch` / `lastTouch` normalize that here so the client never has to
   * know which shape it got. First and last are kept apart on purpose: one
   * names the ad that found the lead, the other the ad that brought them back.
   */
  firstTouch: Attribution | null;
  lastTouch: Attribution | null;
  /** Whether each touch carries fbc/fbp/fbclid — i.e. whether a conversion on
   * this contact can be attributed back to Meta. Drives the "Meta trackable" badge. */
  metaTrackable: { firstTouch: boolean; lastTouch: boolean };
};

/**
 * GET /api/ghl/locations/[locationId]/contacts/[contactId]
 *
 * Notes are included because the detail screen always renders them; the notes
 * collection also has its own endpoint for the post-write refresh.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locationId: string; contactId: string }> },
) {
  const { locationId, contactId } = await params;
  const gate = await gateLocationAndId(locationId, contactId, "contact", CONTEXT);
  if (!gate.ok) return gate.response;

  return ghlJson<ContactDetailResponse>(CONTEXT, async () => {
    const [contact, notes] = await Promise.all([
      getContact(locationId, contactId),
      getNotes(locationId, contactId),
    ]);
    if (!contact) throw new ResourceNotFoundError("Contact not found.");

    const first = firstTouch(contact) ?? null;
    const last = lastTouch(contact) ?? null;

    return {
      contact: { ...contact, displayName: displayName(contact) },
      notes,
      firstTouch: first,
      lastTouch: last,
      metaTrackable: {
        firstTouch: hasMetaIdentifiers(first ?? undefined),
        lastTouch: hasMetaIdentifiers(last ?? undefined),
      },
    };
  });
}
