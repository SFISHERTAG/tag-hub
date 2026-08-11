import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenant } from "@/lib/ghl/tenants";
import { TenantForm } from "./tenant-form";

export const dynamic = "force-dynamic";

export default async function TenantAdminPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const session = await requireSession();
  const { locationId } = await params;

  if (session.role !== "tag_exec") {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only executives can manage tenants.</p>
      </div>
    );
  }

  const tenant = await getTenant(locationId);
  const isNew = tenant.name === `Tenant ${locationId}`;

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
            Name shows as a placeholder until the GHL backfill (Story 1.6) is
            wired; it isn&rsquo;t editable here on purpose, so this page never
            becomes a second place a client name is typed.
          </p>
        )}
      </div>

      <TenantForm tenant={tenant} />
    </div>
  );
}
