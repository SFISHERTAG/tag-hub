/**
 * Webhook reliability primitives: signature verification, idempotency, and a
 * dead letter queue with manual-review flagging. Ported from CCE's Secure
 * Webhook Hub pattern (HMAC verification, idempotency, DLQ) — ownership was
 * fragmented there across every integration; here it's three small modules
 * any future webhook receiver imports instead of reinventing.
 *
 * Not wired to a live route yet. Tag Hub currently polls GHL and doesn't
 * receive webhooks from anywhere. This exists so the first webhook receiver
 * (GHL delivery-status pushes, Meta Conversions API callbacks, whatever
 * Epic 4-6 needs) has somewhere real to land instead of a bespoke
 * try/catch. See README.md in this folder for the intended call shape.
 */

export type DeadLetterReason = "invalid_signature" | "duplicate" | "handler_error" | "unrecognized_event";

export interface DeadLetterEntry {
  id?: string;
  /** Which integration this came from — "ghl", "meta", etc. Not a fixed union; new sources don't require a type change here. */
  source: string;
  reason: DeadLetterReason;
  /** Raw payload, kept for inspection and manual replay. */
  payload: unknown;
  headers?: Record<string, string>;
  /** Handler error message, when reason is "handler_error". */
  error?: string;
  /** Epoch milliseconds. */
  receivedAt: number;
  /** Manual triage: "someone needs to look at this." Distinct from resolved. */
  flagged: boolean;
  flaggedReason?: string;
  flaggedBy?: string;
  flaggedAt?: number;
  /** "Someone did look at this and it's handled." */
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
}
