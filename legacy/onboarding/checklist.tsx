"use client";

import { useState, useTransition } from "react";
import { markTaskComplete } from "./actions";
import type { OnboardingTask } from "@/lib/onboarding/stage-tasks";

export function OnboardingChecklist({
  locationId,
  opportunityId,
  tasks,
  initialCompleted,
  readOnly,
}: {
  locationId: string;
  opportunityId: string;
  tasks: OnboardingTask[];
  initialCompleted: string[];
  readOnly: boolean;
}) {
  const [completed, setCompleted] = useState(new Set(initialCompleted));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(taskId: string) {
    if (readOnly) return;
    const next = !completed.has(taskId);
    setCompleted((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(taskId);
      else updated.delete(taskId);
      return updated;
    });
    setError(null);

    startTransition(async () => {
      const result = await markTaskComplete(locationId, opportunityId, taskId, next);
      if (!result.ok) {
        setCompleted((prev) => {
          const rolledBack = new Set(prev);
          if (next) rolledBack.delete(taskId);
          else rolledBack.add(taskId);
          return rolledBack;
        });
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => {
        const checked = completed.has(task.id);
        return (
          <label
            key={task.id}
            className={`flex items-center gap-2 text-sm ${
              readOnly ? "cursor-default text-ink-2" : "cursor-pointer text-ink"
            } ${checked ? "line-through opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={readOnly || pending}
              onChange={() => toggle(task.id)}
              className="h-4 w-4 rounded border-line-strong"
            />
            {task.label}
          </label>
        );
      })}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
