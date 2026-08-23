import "server-only";
import { repository } from "@/lib/data";
import type { Query } from "@/lib/data";
import type { DeadLetterEntry } from "./types";

/**
 * Record a webhook event that couldn't be processed: bad signature,
 * duplicate delivery caught by lib/webhooks/idempotency.ts, an event type
 * the receiver doesn't recognize, or a handler that threw.
 *
 * This module does not retry anything — it's where a failed event lands so a
 * person can look at it, not a queue that re-delivers itself. Retrying is a
 * decision for whoever's triaging (see flagForReview / resolve below), or a
 * separate scheduled job if that's ever warranted.
 */
export async function recordFailure(
  entry: Omit<DeadLetterEntry, "id" | "flagged" | "resolved" | "receivedAt">,
): Promise<string> {
  return repository().webhookDeadLetter.add({
    ...entry,
    receivedAt: Date.now(),
    flagged: false,
    resolved: false,
  });
}

/**
 * Mark an entry for manual review. Separate from "resolved" on purpose:
 * flagging says a person needs to look at this; resolving says a person did.
 * A failure can be recorded and never flagged (low-signal noise you're
 * choosing to ignore) or flagged and sit unresolved (someone still owes a
 * look) — collapsing the two into one boolean would lose that distinction.
 */
export async function flagForReview(entryId: string, flaggedBy: string, reason?: string): Promise<void> {
  await repository().webhookDeadLetter.doc(entryId).update({
    flagged: true,
    flaggedBy,
    flaggedReason: reason ?? undefined,
    flaggedAt: Date.now(),
  });
}

export async function resolve(entryId: string, resolvedBy: string): Promise<void> {
  await repository().webhookDeadLetter.doc(entryId).update({
    resolved: true,
    resolvedBy,
    resolvedAt: Date.now(),
  });
}

/** Flagged and still unresolved — the "needs a human now" list. */
export async function listFlagged(source?: string): Promise<DeadLetterEntry[]> {
  return list([
    { field: "flagged", op: "==", value: true },
    { field: "resolved", op: "==", value: false },
  ], source);
}

/** Everything unresolved, flagged or not — the full backlog. */
export async function listUnresolved(source?: string): Promise<DeadLetterEntry[]> {
  return list([{ field: "resolved", op: "==", value: false }], source);
}

/**
 * Shared query shape for the two listings above. They differ only by whether
 * `flagged` is required, and the optional source filter behaved identically in
 * both, so it lives here once rather than being repeated with the ordering and
 * the 200 cap alongside it.
 */
async function list(
  where: NonNullable<Query<DeadLetterEntry>["where"]>,
  source?: string,
): Promise<DeadLetterEntry[]> {
  const found = await repository().webhookDeadLetter.list({
    where: source ? [...where, { field: "source", op: "==", value: source }] : where,
    orderBy: { field: "receivedAt", direction: "desc" },
    limit: 200,
  });
  return found.map(({ id, data }) => ({ ...data, id }));
}
