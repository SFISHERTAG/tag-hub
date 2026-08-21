/**
 * The wire shape of `GET /api/portfolio/tenants`, mirrored here so a change on
 * either side is a compile error rather than an undefined at runtime.
 *
 * Nothing in this file is a security boundary. The server derives the tenant
 * list from the session and never from the request, so there is no id for this
 * client to supply and none of these fields can be used to widen access.
 */
export interface PortfolioTenant {
  readonly locationId: string;
  readonly name: string;
}

/**
 * Tenants inside the caller's own grant whose record could not be read.
 *
 * This exists because of the defect being carried forward: the Next page ran
 * `Promise.all` over the tenant lookups, so one unreachable record rejected the
 * whole batch and the switcher rendered as "no clients assigned" — a failure
 * wearing an empty result's clothes. The endpoint settles per tenant now, and
 * this is how many did not make it. The screen must say so; a silently shorter
 * list is the same lie in a quieter voice.
 */
export interface PortfolioUnavailable {
  readonly count: number;
  readonly locationIds: readonly string[];
}

export interface Portfolio {
  /** Loaded tenants, already sorted by name server-side. */
  readonly tenants: readonly PortfolioTenant[];
  readonly unavailable: PortfolioUnavailable;
  /**
   * Whether the enter-a-tenant affordance applies to this hat. COSMETIC ONLY:
   * `POST /api/impersonation/enter` re-checks the role server-side and is the
   * authority. A client ignoring this flag gains nothing.
   */
  readonly canEnter: boolean;
}
