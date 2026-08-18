"use client";

import { useState } from "react";
import { launchCampaign } from "../actions";

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

  if (campaignId) {
    return (
      <p className="rounded-md border border-ok/25 bg-ok-tint px-3 py-2 text-sm text-ok">
        Campaign created (paused): <span className="font-mono">{campaignId}</span>
      </p>
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
