import { requireSession } from "@/lib/auth/session";
import { Panel } from "../ui";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requireSession();

  // Gated on the effective hat, not the raw role — see the identical comment
  // in app/portfolio/page.tsx for why.
  if (!session || !["tag_exec", "tag_csm"].includes(session.hat)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">
          Onboarding is available to TAG executives and CSMs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Onboarding</h1>

      <Panel title="Onboarding pipeline" meta="PR1 → AP2">
        <p className="text-sm text-ink-2">
          Will render as a kanban here, filtered by Fulfillment stage — the
          same client records tracked on{" "}
          <a
            href="/success"
            className="underline-offset-2 hover:underline"
          >
            Client success
          </a>
          .
        </p>
      </Panel>
    </div>
  );
}
