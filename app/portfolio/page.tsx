import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTenant } from "@/lib/ghl/tenants";
import { enterImpersonation } from "@/lib/auth/impersonation-actions";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const { view } = await searchParams;
  // The escalation view (story 3.6) lives on the CSM dashboard, where the
  // health/escalation data model already exists.
  if (view === "escalations") redirect("/csm-dashboard?view=escalations");

  // `Promise.all` rejects on the first failure, so one unreachable tenant
  // record took down the whole switcher and every other client with it — the
  // page a CSM uses to get anywhere. Settled per tenant instead: the ones
  // that resolve still render, and the ones that do not are named rather
  // than silently missing.
  const results = await Promise.allSettled(session.locations.map((id) => getTenant(id)));

  const tenants = results
    .map((result, i) => {
      if (result.status === "fulfilled") return result.value;
      console.error(`[portfolio] Tenant lookup failed for ${session.locations[i]}:`, result.reason);
      return null;
    })
    .filter((tenant): tenant is NonNullable<typeof tenant> => tenant !== null);

  const unavailableCount = results.length - tenants.length;
  tenants.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">My clients</h1>
        <span className="text-sm text-ink-3">
          {tenants.length} {tenants.length === 1 ? "client" : "clients"}
        </span>
      </div>

      {unavailableCount > 0 && (
        <p className="rounded-md border border-warn/30 bg-warn-tint px-3 py-2 text-sm text-warn">
          {unavailableCount} {unavailableCount === 1 ? "client" : "clients"} could not
          be loaded and {unavailableCount === 1 ? "is" : "are"} missing from this
          list. The rest are shown below.
        </p>
      )}

      {tenants.length === 0 ? (
        <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
          <h2 className="text-base font-semibold">No clients assigned</h2>
          <p className="mt-2 text-sm">
            You don&rsquo;t have access to any clients yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <form key={tenant.locationId} action={enterImpersonation.bind(null, tenant.locationId)}>
              <button
                type="submit"
                className="w-full rounded-lg border border-line bg-surface p-4 text-left lift hover:border-line-strong"
              >
                <p className="truncate text-sm font-semibold text-ink">
                  {tenant.name}
                </p>
                <p className="mt-1 truncate text-xs text-ink-3">
                  {tenant.locationId}
                </p>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
