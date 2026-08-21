import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { apiError } from "@/lib/auth/session-cookie";
import { withErrorHandling } from "@/lib/api/errorInterceptor";
import { hasRole, ROLES } from "@/lib/auth/roles";
import { getTenant } from "@/lib/ghl/tenants";

export const dynamic = "force-dynamic";

/**
 * Story 10.4 — the portfolio ("My clients") list. HTTP replacement for the
 * server component in legacy/portfolio/page.tsx, which read lib/ directly.
 *
 * THE LIST IS DERIVED FROM THE SESSION, NEVER FROM THE REQUEST. There is no
 * query parameter and no body here on purpose: `session.locations` is the
 * authoritative set of tenants this hat may see (lib/auth/session.ts resolves it
 * from live claims, and widens it to every tenant only for tag_exec / tag_csd /
 * admin). Accepting a caller-supplied list of ids and looking them up would be
 * the exact enumeration bug the audit found fourteen times.
 *
 * CARRIED-FORWARD DEFECT, do not reintroduce: the Next page used `Promise.all`
 * over getTenant, which rejects on the FIRST failure. One unreachable tenant
 * record therefore emptied the whole switcher — the page a CSM uses to get
 * anywhere — and rendered as "no clients assigned", i.e. a failure disguised as
 * an empty result. Settled per tenant instead: the ones that resolve are
 * returned, and the ones that do not are COUNTED AND NAMED in `unavailable`, so
 * the screen can say "3 clients could not be loaded" rather than quietly
 * shortening the list.
 */
const CONTEXT = "GET /api/portfolio/tenants";

type PortfolioTenant = {
  locationId: string;
  name: string;
};

type PortfolioResponse = {
  /** Loaded tenants, sorted by name. */
  tenants: PortfolioTenant[];
  /**
   * Tenants in the caller's own grant whose record could not be read. Never a
   * disclosure: every id here is already in `session.locations`, which the
   * client holds from its session payload.
   */
  unavailable: { count: number; locationIds: string[] };
  /**
   * Whether the "enter this client" affordance applies to this hat. COSMETIC
   * ONLY — POST /api/impersonation/enter re-checks the role server-side and is
   * the authority. A client that ignores this flag gains nothing.
   */
  canEnter: boolean;
};

export async function GET() {
  const gate = await requireApiSession(CONTEXT);
  if (!gate.ok) return gate.response;

  const { session } = gate;

  const result = await withErrorHandling<PortfolioResponse>(CONTEXT, async () => {
    const locationIds = session.locations;

    // `map` is inside the wrapper because getTenant() can throw synchronously
    // before it ever returns a promise — firestore() throws when
    // GOOGLE_CLOUD_PROJECT is unset — and a synchronous throw never reaches
    // Promise.allSettled.
    const settled = await Promise.allSettled(locationIds.map((id) => getTenant(id)));

    const tenants: PortfolioTenant[] = [];
    const unavailable: string[] = [];

    settled.forEach((outcome, index) => {
      const locationId = locationIds[index];
      if (outcome.status === "fulfilled") {
        tenants.push({ locationId: outcome.value.locationId, name: outcome.value.name });
        return;
      }
      // Logged rather than swallowed: an unreadable tenant is a real fault and
      // the count alone does not say which one or why.
      console.error(`[${CONTEXT}] Tenant lookup failed for ${locationId}:`, outcome.reason);
      unavailable.push(locationId);
    });

    tenants.sort((a, b) => a.name.localeCompare(b.name));

    return {
      tenants,
      unavailable: { count: unavailable.length, locationIds: unavailable },
      canEnter: hasRole(session.currentRole, ROLES.TAG_CSM),
    };
  });

  if (result.error) return apiError(result.error.message, CONTEXT, 500);

  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
