/**
 * The timezone every server-rendered date and time is expressed in.
 *
 * This exists because the code that formats times had no timezone at all, so it
 * used the process's own. On a developer's machine that is US Central and
 * everything looked right. In Cloud Run nothing sets TZ, so Node defaults to
 * UTC: a 9:00 AM Central appointment rendered as "2:00 PM" on the call-prep
 * screen, with no error and no clue, which is the worst possible shape for that
 * particular bug.
 *
 * It is a constant rather than a tenant field ON PURPOSE, and the honesty
 * matters more than the flexibility. There is no timezone anywhere in this
 * system today: not on `Tenant`, not on `LocationConfig`, and not in the live
 * `clients` documents. Inventing a field nothing populates would swap a visible
 * wrong answer for an invisible one that silently falls back to a default
 * anyway.
 *
 * When tenants genuinely need their own, GoHighLevel already carries a timezone
 * on its location object and is the system of record for locations, so the
 * change is to read it there and pass it in. Every function below takes the
 * zone as an argument for exactly that reason: making it per-tenant later means
 * changing call sites, not rewriting formatting.
 */
export const DEFAULT_TIME_ZONE = "America/Chicago";
