import "server-only";
import { getContact, getNotes, type Contact, type Note } from "@/lib/ghl/contacts";
import { getOpportunityForContact, type Opportunity } from "@/lib/ghl/opportunities";
import { displayName } from "@/lib/ghl/format";
import { gateLocationAndId } from "@/app/api/ghl/_lib/gate";
import { ResourceNotFoundError, ghlJson } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/ghl/locations/[locationId]/contacts/[contactId]/prep";

export type PrepResponse = {
  contact: Contact & { displayName: string };
  notes: Note[];
  /** Null when the contact has no opportunity on any pipeline. */
  opportunity: Opportunity | null;
};

/**
 * GET /api/ghl/locations/[locationId]/contacts/[contactId]/prep
 *
 * Ports `getPrepData`: attribution, pipeline stage and value, and notes for one
 * contact. Called when a closer opens the prep panel for a specific appointment
 * row, never as part of the today screen's initial render (Story 2.7 AC4) —
 * three GHL calls per row would make the day view unusable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locationId: string; contactId: string }> },
) {
  const { locationId, contactId } = await params;
  const gate = await gateLocationAndId(locationId, contactId, "contact", CONTEXT);
  if (!gate.ok) return gate.response;

  return ghlJson<PrepResponse>(CONTEXT, async () => {
    const [contact, notes, opportunity] = await Promise.all([
      getContact(locationId, contactId),
      getNotes(locationId, contactId),
      getOpportunityForContact(locationId, contactId),
    ]);
    if (!contact) throw new ResourceNotFoundError("Contact not found.");

    return {
      contact: { ...contact, displayName: displayName(contact) },
      notes,
      opportunity,
    };
  });
}
