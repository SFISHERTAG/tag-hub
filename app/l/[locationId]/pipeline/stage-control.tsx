"use client";

import { useState, useTransition } from "react";
import { moveOpportunityStagAction } from "./actions";
import type { PipelineStage } from "@/lib/ghl/pipelines";

export function StageControl({
  locationId,
  opportunityId,
  currentStageId,
  allStages,
}: {
  locationId: string;
  opportunityId: string;
  currentStageId: string;
  allStages: PipelineStage[];
}) {
  const [stageId, setStageId] = useState(currentStageId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextStageId = e.currentTarget.value;
    if (nextStageId === stageId) return;

    const previous = stageId;
    const previousStageName = allStages.find((s) => s.id === previous)?.name;
    setStageId(nextStageId); // optimistic
    setError(null);

    startTransition(async () => {
      const result = await moveOpportunityStagAction(
        locationId,
        opportunityId,
        nextStageId,
        previousStageName,
      );
      if (!result.ok) {
        setStageId(previous); // roll back
        setError(result.error);
      }
    });
  }

  const currentStage = allStages.find((s) => s.id === stageId)?.name || "Unknown";

  return (
    <div className="flex flex-col gap-1">
      <select
        value={stageId}
        onChange={handleChange}
        disabled={pending}
        className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs font-medium text-ink disabled:opacity-60"
      >
        {allStages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
