import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listAllLocationIds, getTenant, type Tenant } from "@/lib/ghl/tenants";
import { Panel, Fold, Stat, Badge, Donut, Pending, type Segment } from "../ui";
import { EscalationIcon, OnboardingIcon } from "../icons";

export const dynamic = "force-dynamic";

/**
 * Client success — the aggregate view across every account.
 *
 * Ported from CCE's MST dashboard: KPI band, distribution rings, folding
 * detail sections, and a data-integrity audit at the bottom. What is *not*
 * ported is CCE's habit of rendering a zero when a metric has no source. On an
 * operations dashboard a fabricated zero is indistinguishable from a real
 * reading, and someone will staff a decision on it — so anything without a data
 * path renders `<Pending>` naming the story that unblocks it.
 */

type Row = {
  tenant: Tenant;
  connected: { meta: boolean; pixel: boolean };
};

function tenantsToSegments(rows: Row[]): Segment[] {
  const tagOwned = rows.filter((r) => r.tenant.ownerModel === "tag").length;
  return [
    { label: "TAG-owned ad account", value: tagOwned, tone: "accent" },
    {
      label: "Client-owned",
      value: rows.length - tagOwned,
      tone: "info",
    },
  ];
}

function serviceSegments(rows: Row[]): Segment[] {
  const count = (k: keyof Tenant["services"]) =>
    rows.filter((r) => r.tenant.services?.[k]).length;
  return [
    { label: "Ad management", value: count("adManagement"), tone: "accent" },
    { label: "VSL funnel", value: count("vslFunnel"), tone: "info" },
    { label: "Closing team", value: count("closingTeam"), tone: "ok" },
    { label: "Sales enablement", value: count("salesEnablement"), tone: "warn" },
  ];
}

export default async function ClientSuccessPage() {
  const session = await requireSession();

  // Gated on the effective hat, not the raw role — see the identical comment
  // in app/portfolio/page.tsx for why.
  if (!["tag_exec", "tag_csm"].includes(session.hat)) {
    return (
      <Panel title="Access denied">
        <p className="text-sm text-ink-2">
          Client success is available to TAG executives and CSMs.
        </p>
      </Panel>
    );
  }

  let rows: Row[] = [];
  let loadError: string | null = null;

  try {
    const ids = await listAllLocationIds();
    rows = await Promise.all(
      ids.map(async (id) => {
        const tenant = await getTenant(id);
        return {
          tenant,
          connected: {
            meta: Boolean(tenant.metaAdAccountId),
            pixel: Boolean(tenant.metaPixelId),
          },
        };
      }),
    );
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  const total = rows.length;
  const hasBook = total > 0;
  const onboarding = rows.filter((r) => !r.connected.meta).length;
  const metaConnected = rows.filter((r) => r.connected.meta).length;
  const pixelMissing = rows.filter(
    (r) => r.connected.meta && !r.connected.pixel,
  ).length;

  return (
    <div className="relative space-y-6">
      {/* Ambient gold bloom — decorative only, sits behind everything. */}
      <div aria-hidden className="wash" />

      <header className="relative flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Client success</h1>
        <span className="text-sm text-ink-3">
          {total} {total === 1 ? "client" : "clients"}
        </span>
        <Link
          href="/portfolio"
          className="ml-auto text-xs text-ink-2 underline-offset-2 hover:text-ink hover:underline"
        >
          Open portfolio →
        </Link>
      </header>

      {loadError && (
        <Panel title="Could not reach GoHighLevel">
          <p className="font-mono text-xs whitespace-pre-wrap text-danger">
            {loadError}
          </p>
        </Panel>
      )}

      {/* KPI band.
          Every derived tile reads "—" on an empty book rather than 0. A green
          "all tracking" beside zero clients is a false positive: it looks
          identical to a healthy book and is the reassuring-zero problem this
          page exists to avoid. Only `Clients` shows a real 0, because there
          the zero is the measurement rather than the absence of one. */}
      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Clients" value={total} />
        <Stat
          label="Ads live"
          value={hasBook ? metaConnected : "—"}
          delta={
            hasBook
              ? `${Math.round((metaConnected / total) * 100)}% of book`
              : "no clients registered"
          }
          tone={hasBook ? "ok" : "neutral"}
        />
        <Stat
          label="Pre-launch"
          value={hasBook ? onboarding : "—"}
          delta={onboarding > 0 ? "awaiting ad account" : undefined}
          tone={onboarding > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Pixel missing"
          value={hasBook ? pixelMissing : "—"}
          delta={
            !hasBook
              ? undefined
              : pixelMissing > 0
                ? "attribution at risk"
                : "all tracking"
          }
          tone={!hasBook ? "neutral" : pixelMissing > 0 ? "danger" : "ok"}
        />
        <Stat label="Escalations" value="—" delta="Story 3.6" />
      </div>

      {/* Distribution rings */}
      <div className="relative grid gap-3 lg:grid-cols-2">
        <Panel glass title="Service mix" meta="à la carte entitlements">
          {total > 0 ? (
            <Donut segments={serviceSegments(rows)} centerLabel={String(total)} />
          ) : (
            <Pending story="no tenants registered" note="Story 1.6 — tenant registry" />
          )}
        </Panel>

        <Panel glass title="Ad account ownership" meta="who holds the asset">
          {total > 0 ? (
            <Donut segments={tenantsToSegments(rows)} centerLabel={String(total)} />
          ) : (
            <Pending story="no tenants registered" note="Story 1.6 — tenant registry" />
          )}
        </Panel>
      </div>

      {/* Folding detail — CCE's collapsed sections */}
      <div className="relative space-y-3">
        <Fold
          title="Health distribution"
          meta={total ? `${total} clients` : undefined}
        >
          <Pending
            story="Story 3.2 — client health signals"
            note="getClientHealth() is implemented; it needs per-CSM location claims from Story 1.4 to run across the book."
          />
        </Fold>

        <Fold title="Stage velocity" meta="median days in stage">
          <Pending
            story="Story 5.1 — onboarding checklist from Fulfillment stages"
            note="Stage timers come from the Fulfillment opportunity's lastStageChangeAt, already read by getFulfillmentStage()."
          />
        </Fold>

        <Fold title="Speed to lead" meta="lead → first contact">
          <Pending
            story="Story 2.3 — outcome timing capture"
            note="classifyTiming() already records the timestamps this needs."
          />
        </Fold>

        <Fold title="Escalations" meta="needs attention">
          <Pending story="Story 3.6 — escalation view" />
        </Fold>

        {/* CCE's column-mapping audit, pointed at what actually breaks here. */}
        <Fold
          title="Integration & attribution audit"
          defaultOpen={pixelMissing > 0}
          meta={
            pixelMissing > 0 ? (
              <Badge tone="danger">{pixelMissing} at risk</Badge>
            ) : (
              <Badge tone="ok">clean</Badge>
            )
          }
        >
          {total === 0 ? (
            <Pending story="no tenants registered" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-ink-3">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-medium">Client</th>
                    <th className="py-2 pr-4 font-medium">Ad account</th>
                    <th className="py-2 pr-4 font-medium">Pixel</th>
                    <th className="py-2 pr-4 font-medium">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ tenant, connected }) => (
                    <tr
                      key={tenant.locationId}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-2 pr-4 text-ink">{tenant.name}</td>
                      <td className="py-2 pr-4">
                        {connected.meta ? (
                          <Badge tone="ok">connected</Badge>
                        ) : (
                          <Badge tone="warn">not connected</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {connected.pixel ? (
                          <Badge tone="ok">firing</Badge>
                        ) : (
                          <Badge tone="danger">missing</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-ink-2">
                        {tenant.ownerModel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-3 flex items-start gap-2 text-[11px] text-ink-3">
                <EscalationIcon className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
                <span>
                  A missing pixel is silent: that client&apos;s dashboard reports
                  zero conversions while every other account looks fine and the
                  global sync badge stays green. This table is the standing
                  version of the Story 6.1 audit.
                </span>
              </p>
            </div>
          )}
        </Fold>

        <Fold title="Onboarding pipeline" meta="PR1 → AP2">
          <p className="flex items-start gap-2 text-xs text-ink-2">
            <OnboardingIcon className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
            <span>
              Renders as the kanban once Story 5.1 lands — same client records,
              filtered on Fulfillment stage rather than a second status field.
            </span>
          </p>
        </Fold>
      </div>
    </div>
  );
}
