import "server-only";
import type { NextRequest } from "next/server";
import { addNote, getNotes, type Note } from "@/lib/ghl/contacts";
import { gateLocationAndId } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson, readJsonBody } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const GET_CONTEXT = "GET /api/ghl/locations/[locationId]/contacts/[contactId]/notes";
const POST_CONTEXT = "POST /api/ghl/locations/[locationId]/contacts/[contactId]/notes";

/** A note is a free-text field, not a document. The cap exists so an unbounded
 * body cannot be posted straight through to GHL. */
const MAX_NOTE = 10_000;

export type NotesResponse = { notes: Note[] };

export type CreateNoteRequest = { body: string };

/** GET /api/ghl/locations/[locationId]/contacts/[contactId]/notes — newest first. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; contactId: string }> },
) {
  const { locationId, contactId } = await params;
  const gate = await gateLocationAndId(locationId, contactId, "contact", GET_CONTEXT);
  if (!gate.ok) return gate.response;

  return ghlJson<NotesResponse>(GET_CONTEXT, async () => ({
    notes: await getNotes(locationId, contactId),
  }));
}

/**
 * POST /api/ghl/locations/[locationId]/contacts/[contactId]/notes
 *
 * Ports `createNote`. Returns the refreshed list rather than `{ ok: true }`:
 * the legacy action relied on `revalidatePath` to repaint the page, which does
 * not exist for a client that is not a Next page, and a second round trip to
 * read back what we just wrote is a request nobody needs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; contactId: string }> },
) {
  const { locationId, contactId } = await params;
  const gate = await gateLocationAndId(locationId, contactId, "contact", POST_CONTEXT);
  if (!gate.ok) return gate.response;

  const payload = await readJsonBody(request);
  if (!payload) return badRequest(POST_CONTEXT, "Expected a JSON object body.");

  const raw = payload.body;
  if (typeof raw !== "string") return badRequest(POST_CONTEXT, "body is required.");
  const trimmed = raw.trim();
  if (trimmed === "") return badRequest(POST_CONTEXT, "Note is empty.");
  if (trimmed.length > MAX_NOTE) {
    return badRequest(POST_CONTEXT, `Note must be ${MAX_NOTE} characters or fewer.`);
  }

  return ghlJson<NotesResponse>(POST_CONTEXT, async () => {
    await addNote(locationId, contactId, trimmed);
    return { notes: await getNotes(locationId, contactId) };
  });
}
