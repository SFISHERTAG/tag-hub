"use client";

import { useState, useTransition } from "react";
import { markAppointment } from "./actions";
import type { AppointmentStatus } from "@/lib/ghl/appointments";

/**
 * GHL offers six appointment statuses and no "disqualified", so DQ maps onto
 * `invalid` — the slot meant for appointments that should not count.
 *
 * Keeping DQ distinct from no-show matters downstream: a no-show points at the
 * reminder sequence, a DQ points at targeting. Collapsing them would hide which
 * one is actually broken.
 */
const OUTCOMES: { value: AppointmentStatus; label: string; tone: "good" | "bad" | "neutral" }[] = [
  { value: "confirmed", label: "Confirmed", tone: "neutral" },
  { value: "showed", label: "Showed", tone: "good" },
  { value: "noshow", label: "No-show", tone: "bad" },
  { value: "invalid", label: "DQ", tone: "bad" },
  { value: "cancelled", label: "Cancelled", tone: "neutral" },
];

const ACTIVE_STYLES: Record<string, string> = {
  good: "bg-[#ebc507] text-black",
  bad: "bg-neutral-900 text-white",
  neutral: "bg-neutral-200 text-neutral-900",
};

export function StatusControls({
  locationId,
  appointmentId,
  current,
  startTime,
  endTime,
}: {
  locationId: string;
  appointmentId: string;
  current: AppointmentStatus;
  startTime: string;
  endTime: string;
}) {
  const [status, setStatus] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: AppointmentStatus) {
    const previous = status;
    setStatus(next); // optimistic
    setError(null);

    startTransition(async () => {
      const result = await markAppointment(locationId, appointmentId, next, {
        startTime,
        endTime,
      });
      if (!result.ok) {
        setStatus(previous); // roll back rather than lie about the outcome
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {OUTCOMES.map((outcome) => {
          const active = status === outcome.value;
          return (
            <button
              key={outcome.value}
              type="button"
              disabled={pending}
              onClick={() => choose(outcome.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                active
                  ? ACTIVE_STYLES[outcome.tone]
                  : "border border-neutral-300 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {outcome.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="max-w-xs text-right text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
