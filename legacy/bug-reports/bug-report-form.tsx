"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitReport } from "./actions";

const PAGE_AREAS = [
  "Pipeline",
  "Today",
  "Follow-up",
  "Contacts",
  "Client success",
  "Portfolio",
  "Onboarding",
  "Dashboard",
  "Admin",
  "Sign-in",
  "Other",
];

export function BugReportForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await submitReport(new FormData(event.currentTarget));

    if (result.ok) {
      formRef.current?.reset();
      setSubmitted(true);
      // Re-runs the page's server component so "Your reports" picks up the
      // new one — router.refresh() rather than a full reload, so the rest of
      // the client tree (this form's own success state) survives it.
      router.refresh();
    } else {
      setError(result.error);
    }
    setPending(false);
  }

  const fieldClass =
    "w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-sm text-ink-2">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="Short summary of what went wrong"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pageArea" className="block text-sm text-ink-2">
          Where
        </label>
        <select id="pageArea" name="pageArea" className={fieldClass}>
          <option value="">Not sure / doesn&rsquo;t apply</option>
          {PAGE_AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm text-ink-2">
          What happened
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          placeholder="What did you expect, and what happened instead?"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="stepsToReproduce" className="block text-sm text-ink-2">
          Steps to reproduce <span className="text-ink-3">(optional)</span>
        </label>
        <textarea
          id="stepsToReproduce"
          name="stepsToReproduce"
          rows={3}
          placeholder="1. Went to... 2. Clicked..."
          className={fieldClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {submitted && !pending && (
        <p className="text-sm text-ok">Thanks — that&rsquo;s been logged.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit report"}
      </button>
    </form>
  );
}
