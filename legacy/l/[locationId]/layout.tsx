import { notFound } from "next/navigation";
import { requireSession, requireLocationAccess } from "@/lib/auth/session";
import { isValidLocationId, getTenant } from "@/lib/ghl/tenants";
import { getLastUpdated } from "@/lib/dashboard/freshness";
import { LocationSwitcher } from "./location-switcher";
import { FreshnessIndicator } from "./freshness-indicator";

export const dynamic = "force-dynamic";

/**
 * Guards every route under /l/[locationId]/. A layout runs before its pages,
 * so a new page added here inherits the access check by construction — the
 * per-page guard is the failure mode this avoids.
 */
export default async function LocationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  if (!isValidLocationId(locationId)) notFound();

  const session = await requireSession();

  try {
    await requireLocationAccess(locationId);
  } catch {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">
          You don&rsquo;t have access to this client.
        </p>
      </div>
    );
  }

  const tenant = await getTenant(locationId);
  const otherLocations = session.locations.filter((id) => id !== locationId);
  const showSwitcher = otherLocations.length > 0;
  const lastUpdated = await getLastUpdated(locationId);

  // Names for the switcher only — the current tenant's name is already
  // fetched above, so it isn't re-requested here.
  const switcherLocations = showSwitcher
    ? await Promise.all(
        session.locations.map(async (id) => ({
          locationId: id,
          name: id === locationId ? tenant.name : (await getTenant(id)).name,
        })),
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-ink-3">Client</p>
          <p className="truncate text-sm font-semibold text-ink">
            {tenant.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FreshnessIndicator locationId={locationId} timestamp={lastUpdated.timestamp} />
          {showSwitcher && (
            <LocationSwitcher current={locationId} locations={switcherLocations} />
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
