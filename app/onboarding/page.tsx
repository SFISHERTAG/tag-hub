import { getSession, getImpersonation } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isClientUser } from "@/lib/dashboard/location-selection";
import { getFulfillmentOpportunity } from "@/lib/ghl/portfolio";
import { daysSince } from "@/lib/ghl/opportunities";
import { getTenant } from "@/lib/ghl/tenants";
import {
  STAGE_TASKS,
  FULFILLMENT_STAGE_ORDER,
  parseFulfillmentStage,
} from "@/lib/onboarding/stage-tasks";
import { loadCompletedTasks } from "@/lib/onboarding/store";
import { Panel } from "../ui";
import { OnboardingChecklist } from "./checklist";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (!["tag_exec", "tag_csm"].includes(session.currentRole)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">
          Onboarding is available to TAG executives and CSMs.
        </p>
      </div>
    );
  }

  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">Onboarding</h1>
      <a
        href="/onboarding/launch"
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
      >
        Launch campaign
      </a>
    </div>
  );

  // Same "entered via 3.3" resolution 5.4's launch flow uses
  // (app/onboarding/launch/actions.ts) — the checklist follows whichever
  // client the CSM is currently inside.
  const impersonation = await getImpersonation();
  const locationId =
    impersonation && impersonation.actorId === session.uid
      ? impersonation.locationId
      : null;

  if (!locationId) {
    return (
      <div className="space-y-6">
        {header}
        <Panel title="No client selected">
          <p className="text-sm text-ink-2">
            Enter a client from{" "}
            <a href="/portfolio" className="underline-offset-2 hover:underline">
              Portfolio
            </a>{" "}
            to see their onboarding checklist.
          </p>
        </Panel>
      </div>
    );
  }

  const [tenant, fulfillment] = await Promise.all([
    getTenant(locationId),
    getFulfillmentOpportunity(locationId),
  ]);

  if (!fulfillment) {
    return (
      <div className="space-y-6">
        {header}
        <Panel title={tenant.name}>
          <p className="text-sm text-ink-2">
            No Fulfillment opportunity found for this client yet.
          </p>
        </Panel>
      </div>
    );
  }

  const { opportunity, stageName } = fulfillment;
  // Parsed rather than matched exactly: GHL's stage names carry a label
  // after the code ("AP 2 - Ads Launched"), so an exact match never hit and
  // every client past PR1 got "Stage unrecognized" and an empty checklist.
  const stage = parseFulfillmentStage(stageName);
  const tasks = stage ? STAGE_TASKS[stage] : [];
  const completed = await loadCompletedTasks(locationId, opportunity.id);
  const days = daysSince(opportunity.lastStageChangeAt ?? opportunity.updatedAt);
  const readOnly = isClientUser(session.currentRole);

  return (
    <div className="space-y-4">
      {header}

      <Panel
        title={`${tenant.name} — ${stage ?? "Stage unrecognized"}`}
        meta={
          <span className="text-xs text-ink-3">
            {days !== null ? `${days}d in stage` : "No stage change on record"}
          </span>
        }
      >
        {!stage && (
          <p className="mb-3 text-sm text-ink-2">
            Current stage &ldquo;{stageName ?? "unknown"}&rdquo; doesn&rsquo;t
            match a known Fulfillment stage (PR1&ndash;AP5) &mdash; no fixed
            tasks to show.
          </p>
        )}
        {tasks.length > 0 && (
          <OnboardingChecklist
            locationId={locationId}
            opportunityId={opportunity.id}
            tasks={tasks}
            initialCompleted={[...completed]}
            readOnly={readOnly}
          />
        )}
      </Panel>

      <p className="text-xs text-ink-3">
        Pipeline: {FULFILLMENT_STAGE_ORDER.join(" → ")}
      </p>
    </div>
  );
}
