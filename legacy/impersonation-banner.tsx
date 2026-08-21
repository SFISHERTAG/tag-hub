import { getTenant } from "@/lib/ghl/tenants";
import { exitImpersonation } from "@/lib/auth/impersonation-actions";

/**
 * Story 3.4 — unmissable while impersonating: fixed above the app header
 * (which shifts down to make room, see app/layout.tsx), high-contrast, and
 * present on every page since it lives in the root layout.
 */
export async function ImpersonationBanner({ locationId }: { locationId: string }) {
  const tenant = await getTenant(locationId);

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-10 items-center justify-center gap-4 bg-danger px-4 text-sm font-semibold text-white shadow-lg">
      <span className="truncate">
        You are viewing {tenant.name}&rsquo;s account.
      </span>
      <form action={exitImpersonation}>
        <button
          type="submit"
          className="shrink-0 rounded bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-white/30"
        >
          Exit
        </button>
      </form>
    </div>
  );
}
