/**
 * Presentation helpers, safe on both sides of the boundary.
 *
 * These used to live in `contacts.ts` and `opportunities.ts`. Those modules are
 * `server-only` because they hold the fetching code, so a client component that
 * wanted `formatMoney` pulled the whole Firestore + gRPC stack toward the
 * browser bundle — which fails with a wall of "Can't resolve 'net' / 'tls' /
 * 'http2'", naming Node built-ins the developer never imported and pointing at
 * `node_modules` rather than at the one bad import.
 *
 * Nothing here touches the network or the filesystem: pure functions over data
 * already fetched. Keeping them in their own module means the boundary is
 * visible in the import graph instead of implied.
 *
 * Deliberately NOT marked `server-only` — that marker is the bug this file
 * exists to avoid. The types below are `import type` and erase at compile time,
 * so importing them from a `server-only` module emits no runtime edge.
 */

import type { Contact, Attribution } from "./contacts";

export function firstTouch(contact: Contact): Attribution | undefined {
  return contact.attributionSource ?? contact.attributions?.[0];
}

export function lastTouch(contact: Contact): Attribution | undefined {
  return contact.lastAttributionSource;
}

export function displayName(contact: Contact): string {
  const composed = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return contact.contactName?.trim() || composed || contact.email || "Unnamed";
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export function daysSince(timestamp: string | undefined): number | null {
  if (!timestamp) return null;
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
