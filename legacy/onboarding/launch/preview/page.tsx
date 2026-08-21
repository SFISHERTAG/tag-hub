import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { getCampaignTemplate } from "@/lib/onboarding/campaign-templates";
import { parseCampaignFormInputs } from "@/lib/onboarding/campaign-launch";
import { CampaignPreview } from "./campaign-preview";

export const dynamic = "force-dynamic";

export default async function CampaignLaunchPreviewPage({
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
        <h1 className="text-xl font-semibold tracking-tight">Review campaign</h1>
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
      <h1 className="text-xl font-semibold tracking-tight">Review campaign</h1>
      <CampaignPreview
        campaign={{
          client: parsed.value.clientName,
          offer: parsed.value.offerId,
          budget: parsed.value.monthlyBudget,
          cap: parsed.value.dailyCap,
          pixel: parsed.value.pixelId,
        }}
        template={template}
        editHref={`/onboarding/launch?${editQuery}`}
      />
    </div>
  );
}
