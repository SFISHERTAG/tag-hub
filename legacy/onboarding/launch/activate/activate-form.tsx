"use client";

import { useState } from "react";
import { launchCampaign } from "../actions";
import { activateCampaignAction } from "./activate-campaign-action";

export function ActivateForm({
  client,
  offer,
  budget,
  cap,
  pixel,
  editHref,
}: {
  client: string;
  offer: string;
  budget: string;
  cap: string;
  pixel: string;
  editHref: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activatedStage, setActivatedStage] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await launchCampaign(new FormData(event.currentTarget));

    if (result.ok) {
      setCampaignId(result.campaignId);
    } else {
      setError(result.error);
    }
    setPending(false);
  }

  async function handleActivate() {
    setActivating(true);
    setActivateError(null);

    const result = await activateCampaignAction(campaignId!);
    if (result.ok) {
      setActivatedStage(result.stageName);
    } else {
      setActivateError(result.error);
    }
    setActivating(false);
  }

  /*
   * Activation is a separate, deliberate step.
   *
   * Story 5.5's action existed and had zero call sites: this button
   * submitted the create-paused action, so every campaign launched through
   * the app stayed paused in Meta forever while the story read as Done. It
   * is a second click rather than part of the first because unpausing starts
   * real ad spend against a client's budget, and "created" and "now
   * spending" should never be the same confirmation.
   */
  if (campaignId) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-ok/25 bg-ok-tint px-3 py-2 text-sm text-ok">
          Campaign created (paused): <span className="font-mono">{campaignId}</span>
        </p>

        {activatedStage ? (
          <p className="rounded-md border border-ok/25 bg-ok-tint px-3 py-2 text-sm text-ok">
            Campaign is live on Meta. Fulfillment moved to{" "}
            <span className="font-medium">{activatedStage}</span>.
          </p>
        ) : (
          <>
            {activateError && (
              <p
                role="alert"
                className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger"
              >
                {activateError}
              </p>
            )}
            <p className="text-sm text-ink-2">
              Nothing is spending yet. Activating unpauses the campaign in Meta
              and starts real ad spend against this client&apos;s budget.
            </p>
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
            >
              {activating ? "Activating…" : "Activate campaign (starts spend)"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="client" value={client} />
      <input type="hidden" name="offer" value={offer} />
      <input type="hidden" name="budget" value={budget} />
      <input type="hidden" name="cap" value={cap} />
      <input type="hidden" name="pixel" value={pixel} />

      {error && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Confirm & create paused campaign"}
        </button>
        <a
          href={editHref}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-raised"
        >
          Edit
        </a>
      </div>
    </form>
  );
}
