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

  const tenants = await Promise.all(session.locations.map((id) => getTenant(id)));
  tenants.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">My clients</h1>
        <span className="text-sm text-ink-3">
          {tenants.length} {tenants.length === 1 ? "client" : "clients"}
        </span>
      </div>

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
