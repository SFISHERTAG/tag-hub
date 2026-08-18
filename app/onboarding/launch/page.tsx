import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { Panel } from "../../ui";
import { CampaignLaunchForm } from "./campaign-launch-form";
import { CAMPAIGN_TEMPLATES } from "@/lib/onboarding/campaign-templates";

export const dynamic = "force-dynamic";

export default async function CampaignLaunchPage({
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
  const initial = {
    client: typeof params.client === "string" ? params.client : "",
    offer: typeof params.offer === "string" ? params.offer : "",
    budget: typeof params.budget === "string" ? params.budget : "",
    cap: typeof params.cap === "string" ? params.cap : "",
    pixel: typeof params.pixel === "string" ? params.pixel : "",
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Launch campaign</h1>

      <Panel title="Campaign template" meta="Creates paused">
        <p className="mb-4 text-sm text-ink-2">
          Fills in the offer&rsquo;s template and creates the campaign paused
          in Meta Ads Manager for review before it starts spending.
        </p>
        <CampaignLaunchForm initial={initial} offers={CAMPAIGN_TEMPLATES} />
      </Panel>
    </div>
  );
}
