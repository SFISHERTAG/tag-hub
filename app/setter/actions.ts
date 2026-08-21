"use server";

import { getSession, requireLocationAccess } from "@/lib/auth/session";
import {
  getSetterMetrics,
  getSetterLeads,
  type LeadMetric,
  type SetterMetrics,
} from "@/lib/dashboard/speed-to-lead";

export type SetterRefresh =
  | { ok: true; metrics: SetterMetrics; leads: LeadMetric[] }
  | { ok: false; error: string };

/**
 * Refreshes the setter dashboard.
 *
 * The dashboard used to poll `POST /api/setter/metrics` every ten seconds.
 * That route does not exist anywhere in the tree, so every refresh 404'd,
 * `response.ok` was false, the catch did nothing, and the page sat frozen on
 * its page-load data showing nothing to say so. On a speed-to-lead board,
 * where the whole point is the two-minute window, a silently frozen queue is
 * worse than no refresh at all.
 *
 * A server action rather than a new route: that is how the rest of this
 * codebase does it, and it gets the session check for free instead of
 * trusting a `setterEmail` posted by the caller.
 */
export async function refreshSetterDashboard(locationId: string): Promise<SetterRefresh> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  // requireLocationAccess is main's tenant gate. It throws on a denial, and
  // its no-session branch redirects, which is why the session is resolved
  // first: a redirect thrown in here would be swallowed by the catch.
  try {
    await requireLocationAccess(locationId);
  } catch {
    return { ok: false, error: "That client account is not available to this login." };
  }

  // The setter is the caller, taken from the session. The old route read it
  // from the request body, which would have let any caller pull any setter's
  // queue had it existed.
  const email = session.email ?? "";

  const [metricsResult, leadsResult] = await Promise.all([
    getSetterMetrics(locationId, email),
    getSetterLeads(locationId, email),
  ]);

  if (metricsResult.error) return { ok: false, error: metricsResult.error.message };
  if (leadsResult.error) return { ok: false, error: leadsResult.error.message };

  return { ok: true, metrics: metricsResult.data, leads: leadsResult.data };
}
