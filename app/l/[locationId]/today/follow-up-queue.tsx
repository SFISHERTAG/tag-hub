"use client";

import { useState, useTransition } from "react";
import type { FollowUpCandidate, FollowUpConfig } from "@/lib/ghl/store";
import { setFollowUpConfig } from "./actions";

/**
 * Story 2.8: contacts who no-showed or DQ'd with nothing newer booked since.
 * Membership and clearance are derived server-side in page.tsx from the
 * appointment outcomes already loaded there — no per-row fetch here.
 */
export function FollowUpQueue({
  locationId,
  candidates,
  config,
  canConfigure,
}: {
  locationId: string;
  candidates: FollowUpCandidate[];
  config: FollowUpConfig;
  canConfigure: boolean;
}) {
  return (
    <div className="space-y-3 border-t border-line pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-ink">Needs follow-up</h2>
          <span className="text-sm text-ink-3">
            {candidates.length} {candidates.length === 1 ? "contact" : "contacts"}
          </span>
        </div>
        {canConfigure && <ThresholdConfig locationId={locationId} config={config} />}
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing waiting on a follow-up.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((candidate) => (
            <div
              key={candidate.contactId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{candidate.contactName}</p>
                <p className="mt-0.5 truncate text-xs text-ink-3">
                  {candidate.appointmentTitle} ·{" "}
                  {candidate.status === "noshow" ? "No-show" : "DQ"} ·{" "}
                  {candidate.attempts} {candidate.attempts === 1 ? "attempt" : "attempts"}
                </p>
              </div>
              <span className="text-xs text-ink-3">{relativeDays(candidate.markedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function relativeDays(markedAt: number): string {
  const days = Math.floor((Date.now() - markedAt) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function ThresholdConfig({
  locationId,
  config,
}: {
  locationId: string;
  config: FollowUpConfig;
}) {
  const [mode, setMode] = useState(config.mode);
  const [value, setValue] = useState(String(config.value));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    const numValue = Number(value);

    startTransition(async () => {
      const result = await setFollowUpConfig(locationId, { mode, value: numValue });
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
      <span>Ages out after</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="w-16 rounded border border-line-strong bg-raised px-2 py-1 text-ink"
      />
      <select
        value={mode}
        onChange={(e) => {
          setMode(e.target.value as FollowUpConfig["mode"]);
          setSaved(false);
        }}
        className="rounded border border-line-strong bg-raised px-2 py-1 text-ink"
      >
        <option value="days">days</option>
        <option value="attempts">attempts</option>
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-full border border-line-strong px-2.5 py-1 font-medium text-ink-2 hover:border-line-strong disabled:opacity-60"
      >
        Save
      </button>
      {saved && <span className="text-accent">Saved</span>}
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}
