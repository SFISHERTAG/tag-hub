import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listAllLocationIds, getTenant } from "@/lib/ghl/tenants";
import { NewTenantForm } from "./new-tenant-form";

export const dynamic = "force-dynamic";

export default async function TenantsAdminPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  // Only admins can manage tenants
  if (session.currentRole !== "admin") {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only admins can manage tenants.</p>
      </div>
    );
  }

  const locationIds = await listAllLocationIds();
  const tenants = await Promise.all(locationIds.map((id) => getTenant(id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Tenants</h1>
          <span className="text-sm text-ink-3">
            {tenants.length} {tenants.length === 1 ? "tenant" : "tenants"}
          </span>
        </div>
        <NewTenantForm />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-2 text-left font-semibold">Location ID</th>
              <th className="px-4 py-2 text-left font-semibold">Name</th>
              <th className="px-4 py-2 text-center font-semibold">Services</th>
              <th className="px-4 py-2 text-left font-semibold">Meta Pixel</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => {
              const serviceCount = Object.values(tenant.services).filter(Boolean).length;
              return (
                <tr key={tenant.locationId} className="border-b border-line hover:bg-raised">
                  <td className="px-4 py-3 font-mono text-xs">{tenant.locationId}</td>
                  <td className="px-4 py-3">{tenant.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block rounded-full bg-raised px-2 py-1 text-xs">
                      {serviceCount}/5
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-3">
                    {tenant.metaPixelId || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${tenant.locationId}`}
                      className="text-accent hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-3">
                  No tenants yet. Add one by GHL location id above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
