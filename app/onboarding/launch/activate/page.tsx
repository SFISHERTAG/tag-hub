import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { Panel } from "../../../ui";
import { getCampaignTemplate } from "@/lib/onboarding/campaign-templates";
import { parseCampaignFormInputs } from "@/lib/onboarding/campaign-launch";
import { ActivateForm } from "./activate-form";

export const dynamic = "force-dynamic";

export default async function CampaignLaunchActivatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (!hasAnyRole(session.currentRole, ["tag_exec", "tag_csm"])) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">
          Campaign launch is available to TAG executives and CSMs.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const raw = {
    client: typeof params.client === "string" ? params.client : "",
    offer: typeof params.offer === "string" ? params.offer : "",
    budget: typeof params.budget === "string" ? params.budget : "",
    cap: typeof params.cap === "string" ? params.cap : "",
    pixel: typeof params.pixel === "string" ? params.pixel : "",
  };

  const parsed = parseCampaignFormInputs(raw);
  const template = parsed.ok ? getCampaignTemplate(parsed.value.offerId) : undefined;

  if (!parsed.ok || !template) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Confirm campaign</h1>
        <p className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {parsed.ok ? "Unknown offer." : parsed.error}
        </p>
        <a href="/onboarding/launch" className="text-sm underline underline-offset-2">
          Back to form
        </a>
      </div>
    );
  }

  const editQuery = new URLSearchParams(raw).toString();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Confirm campaign</h1>

      <Panel title={template.offerLabel} meta="Will be created paused">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-ink-3">Client</dt>
          <dd className="text-ink">{parsed.value.clientName}</dd>

          <dt className="text-ink-3">Monthly budget</dt>
          <dd className="text-ink">${parsed.value.monthlyBudget.toLocaleString()}</dd>

          <dt className="text-ink-3">Daily cap</dt>
          <dd className="text-ink">${parsed.value.dailyCap.toLocaleString()}</dd>

          <dt className="text-ink-3">Conversion pixel</dt>
          <dd className="text-ink font-mono">{parsed.value.pixelId}</dd>
        </dl>

        <div className="mt-6">
          <ActivateForm
            client={raw.client}
            offer={raw.offer}
            budget={raw.budget}
            cap={raw.cap}
            pixel={raw.pixel}
            editHref={`/onboarding/launch?${editQuery}`}
          />
        </div>
      </Panel>
    </div>
  );
}
