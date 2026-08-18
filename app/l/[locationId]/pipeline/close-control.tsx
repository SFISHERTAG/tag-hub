"use client";

import { useState, useTransition } from "react";
import { closeOpportunityAction } from "./actions";
import type { OpportunityStatus } from "@/lib/ghl/opportunities";

type CloseAction = "none" | "won" | "lost";

export function CloseControl({
  locationId,
  opportunityId,
  currentStatus,
  currentValue,
  contactId,
}: {
  locationId: string;
  opportunityId: string;
  currentStatus: OpportunityStatus;
  currentValue: number;
  contactId?: string;
}) {
  const [action, setAction] = useState<CloseAction>("none");
  const [value, setValue] = useState(currentValue > 0 ? String(currentValue) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isClosed = currentStatus === "won" || currentStatus === "lost";

  function handleClose() {
    setError(null);

    if (action === "none") {
      setAction("none");
      return;
    }

    if (isClosed) {
      setError(`Deal is already ${currentStatus}.`);
      return;
    }

    if (action === "won" && !value) {
      setError("Value is required when marking won.");
      return;
    }

    const numValue = action === "won" ? Number(value) : 0;

    startTransition(async () => {
      const result = await closeOpportunityAction(
        locationId,
        opportunityId,
        action,
        numValue,
        contactId,
      );
      if (!result.ok) {
        setError(result.error);
      } else {
        setAction("none");
        setValue("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.currentTarget.value as CloseAction);
            setError(null);
          }}
          disabled={pending || isClosed}
          className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs font-medium text-ink disabled:opacity-60"
        >
          <option value="none">Mark as...</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>

        {action === "won" && (
          <input
            type="number"
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            disabled={pending}
            className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs font-medium text-ink placeholder:text-ink-3 disabled:opacity-60 w-20"
          />
        )}

        {action !== "none" && (
          <button
            onClick={handleClose}
            disabled={pending}
            className="rounded-md bg-chrome-hover px-2 py-1 text-xs font-medium text-white hover:bg-chrome-hover disabled:opacity-60"
          >
            {pending ? "..." : "Confirm"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
