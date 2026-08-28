/**
 * Types for `find-stranded-claims.mjs`.
 *
 * Declared here rather than left to inference. `tsconfig.json` sets `allowJs`
 * with `strict` but not `checkJs`, so the root typecheck reads the script and
 * infers from it without honouring its JSDoc. Every array in that file starts as
 * an empty literal, which infers as `never[]` and is not widened by later
 * pushes, so every consumer saw `never` and could not read a field off a row.
 *
 * The Next app job caught it. `npm test` and `npm run lint` do not typecheck and
 * never would have, which is why five review passes over this file's logic did
 * not see it: typecheck is a different axis from correctness.
 */

/** One `provisioningLog` entry, flattened. */
export type LogEvent = {
  locationId: string;
  type: string;
  opportunityId: string | null;
  ts: number | null;
};

/** One `webhookEventsProcessed` document: its id plus its fields. */
export type ClaimDoc = { id: string; processedAt?: number | null };

/** A classified claim. `locationId` is present only once a start has resolved. */
export type ClaimRow = {
  source: string;
  eventId: string;
  ageH: string;
  claimedAt: number | null;
  locationId?: string;
};

/** A `*_started` event with no established later completion. */
export type StartRow = { source: string; locationId: string; ts: number | null };

export type Classified = {
  stranded: ClaimRow[];
  complete: ClaimRow[];
  noStart: ClaimRow[];
  unjoinable: ClaimRow[];
  indeterminate: ClaimRow[];
};

export function classifyClaims(
  claimDocs: ClaimDoc[],
  events: LogEvent[],
  nowMs: number,
): Classified;

export function findOrphanStarts(events: LogEvent[]): {
  orphans: StartRow[];
  indeterminate: StartRow[];
};

export function reconcileSides(
  claims: Classified,
  orphans: StartRow[],
): {
  orphansOnly: StartRow[];
  startedNeverFinished: number;
  claimsWithNoStart: number;
};
