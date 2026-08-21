import "server-only";
import { after, type NextRequest } from "next/server";
import { getImpersonation } from "@/lib/auth/session";
import { closeOpportunity } from "@/lib/ghl/opportunities";
import { getContact } from "@/lib/ghl/contacts";
import { logAction } from "@/lib/audit/store";
import { dispatchClosedWon } from "@/lib/meta/conversions";
import { withErrorHandling } from "@/lib/api/errorInterceptor";
import { gateLocationAndId } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson, isSafeGhlId, readJsonBody } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "PUT /api/ghl/locations/[locationId]/opportunities/[opportunityId]/close";

const CLOSE_STATUSES = ["won", "lost"] as const;
type CloseStatus = (typeof CLOSE_STATUSES)[number];

export type CloseOpportunityRequest = {
  status: CloseStatus;
  monetaryValue: number;
  /** Present when the board already has the contact id in scope. Required for
   * the Meta closed_won dispatch; the close itself succeeds without it. */
  contactId?: string;
};

export type CloseOpportunityResponse = {
  opportunityId: string;
  status: string;
  monetaryValue: number;
};

/**
 * PUT /api/ghl/locations/[locationId]/opportunities/[opportunityId]/close
 *
 * Ports `closeOpportunityAction`, including its non-blocking Meta dispatch:
 * the closer's work is the close, and a Meta outage must never be able to slow
 * it down or fail it. `after()` runs the dispatch once the response has gone
 * out, and `withErrorHandling` is what stops a throw in there from becoming an
 * unhandled rejection nobody sees.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; opportunityId: string }> },
) {
  const { locationId, opportunityId } = await params;
  const gate = await gateLocationAndId(locationId, opportunityId, "opportunity", CONTEXT);
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const body = await readJsonBody(request);
  if (!body) return badRequest(CONTEXT, "Expected a JSON object body.");

  const status = body.status;
  if (typeof status !== "string" || !CLOSE_STATUSES.includes(status as CloseStatus)) {
    return badRequest(CONTEXT, `status must be one of: ${CLOSE_STATUSES.join(", ")}.`);
  }

  const monetaryValue = body.monetaryValue;
  if (typeof monetaryValue !== "number" || !Number.isFinite(monetaryValue) || monetaryValue < 0) {
    return badRequest(CONTEXT, "monetaryValue must be a number of zero or more.");
  }

  let contactId: string | undefined;
  if (body.contactId !== undefined) {
    if (typeof body.contactId !== "string" || !isSafeGhlId(body.contactId)) {
      return badRequest(CONTEXT, "Malformed contact id.");
    }
    contactId = body.contactId;
  }

  return ghlJson<CloseOpportunityResponse>(CONTEXT, async () => {
    const result = await closeOpportunity(
      locationId,
      opportunityId,
      status as CloseStatus,
      monetaryValue,
    );

    const impersonation = await getImpersonation();
    await logAction(locationId, {
      actorId: session.uid,
      actorRole: session.currentRole,
      action: "opportunity.close",
      targetType: "opportunity",
      targetId: opportunityId,
      auditEntryId: impersonation?.auditEntryId,
      metadata: { status, monetaryValue },
    });

    // Story 6.3: teach Meta's algorithm the deal's value, not just that a
    // close happened.
    if (status === "won" && contactId) {
      const closedContactId = contactId;
      const closedValue = result.monetaryValue;
      after(async () => {
        const dispatched = await withErrorHandling(
          `dispatchClosedWon(${locationId}, ${opportunityId})`,
          async () => {
            const contact = await getContact(locationId, closedContactId);
            if (!contact) {
              throw new Error(
                `Contact ${closedContactId} not found — closed_won not sent to Meta.`,
              );
            }
            await dispatchClosedWon(locationId, opportunityId, contact, closedValue);
            return true;
          },
        );

        // The close already succeeded and the response is sent; there is
        // nobody left to tell. `withErrorHandling` has logged it with full
        // context, which is what the retry cron reads.
        void dispatched;
      });
    }

    return { opportunityId, status: result.status, monetaryValue: result.monetaryValue };
  });
}
