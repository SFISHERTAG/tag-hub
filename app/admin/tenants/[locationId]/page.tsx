import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenant, tenantDocExists, isValidLocationId } from "@/lib/ghl/tenants";
import { TenantForm } from "./tenant-form";

export const dynamic = "force-dynamic";

export default async function TenantAdminPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const session = await requireSession();
  const { locationId } = await params;

  // A location id is about to become a Firestore document id. Reject
  // anything a typed-in URL could smuggle through that a form's own
  // client-side check wouldn't have — a `/` above all, which Firestore reads
  // as a path separator rather than a literal character.
  if (!isValidLocationId(locationId)) notFound();

  // Gated on the effective hat — see the identical comment in
  // app/admin/tenants/page.tsx for why this is safe.
  if (session.hat !== "tag_exec") {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only executives can manage tenants.</p>
      </div>
    );
  }

  const [tenant, exists] = await Promise.all([
    getTenant(locationId),
    tenantDocExists(locationId),
  ]);
  const isNew = !exists;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/tenants" className="text-xs text-ink-3 hover:text-ink-2">
          ← Tenants
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{tenant.name}</h1>
          <span className="font-mono text-xs text-ink-3">{tenant.locationId}</span>
        </div>
        {isNew && (
          <p className="mt-2 max-w-xl text-xs text-warn">
            No document yet for this location — saving below creates one.
            Name shows as a placeholder until it syncs from GHL; it
            isn&rsquo;t editable here on purpose, so this page never becomes
            a second place a client name is typed.
          </p>
        )}
      </div>

      {/* Keyed on locationId so navigating between two tenants' edit pages
          remounts the form instead of reusing state seeded from the last one. */}
      <TenantForm key={tenant.locationId} tenant={tenant} />
    </div>
  );
}
