import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await requireSession();

  // TODO: Story 1.4/1.6 — Get CSM&rsquo;s assigned locations from role/organization
  // For now, scaffold with a placeholder
  const assignedLocations: string[] = [];

  // Gated on the effective hat, not the raw role — this is what lets tag_exec
  // preview any view by switching hats, matching hat-switcher.tsx's own
  // documented promise. Every other role can only ever wear its own hat
  // (roles.ts's WEARABLE map), so this is a no-op change for anyone but
  // tag_exec: hat === role for them always.
  if (!session || session.hat !== "tag_csm") {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only CSMs can view the portfolio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">My clients</h1>
        <span className="text-sm text-ink-3">
          {assignedLocations.length} {assignedLocations.length === 1 ? "client" : "clients"}
        </span>
      </div>

      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Setup needed</h2>
        <p className="mt-2 text-sm">
          <code>TODO: Story 1.4/1.6</code> — Assigned locations not yet implemented. This page needs
          to fetch the CSM&rsquo;s assigned clients from the role/organization configuration.
        </p>
      </div>
    </div>
  );
}
