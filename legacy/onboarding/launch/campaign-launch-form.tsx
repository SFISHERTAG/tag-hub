"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { CampaignTemplate } from "@/lib/onboarding/campaign-templates";

type Initial = {
  client: string;
  offer: string;
  budget: string;
  cap: string;
  pixel: string;
};

export function CampaignLaunchForm({
  initial,
  offers,
}: {
  initial: Initial;
  offers: CampaignTemplate[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Initial>(key: K, value: Initial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!values.client.trim() || !values.offer || !values.budget || !values.cap || !values.pixel.trim()) {
      setError("All fields are required.");
      return;
    }

    const budget = Number(values.budget);
    const cap = Number(values.cap);

    if (!Number.isFinite(budget) || budget < 100) {
      setError("Monthly budget must be at least $100.");
      return;
    }
    if (!Number.isFinite(cap) || cap > budget / 30) {
      setError("Daily cap can't exceed monthly budget ÷ 30.");
      return;
    }

    setError(null);

    const query = new URLSearchParams({
      client: values.client.trim(),
      offer: values.offer,
      budget: String(budget),
      cap: String(cap),
      pixel: values.pixel.trim(),
    });
    router.push(`/onboarding/launch/preview?${query.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <label className="block text-sm">
        <span className="text-ink-2">Client name</span>
        <input
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          value={values.client}
          onChange={(e) => update("client", e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="text-ink-2">Offer</span>
        <select
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          value={values.offer}
          onChange={(e) => update("offer", e.target.value)}
        >
          <option value="">Select an offer</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.offerLabel}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-ink-2">Monthly budget ($)</span>
          <input
            type="number"
            min={100}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            value={values.budget}
            onChange={(e) => update("budget", e.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="text-ink-2">Daily cap ($)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            value={values.cap}
            onChange={(e) => update("cap", e.target.value)}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-ink-2">GHL conversion pixel ID</span>
        <input
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          value={values.pixel}
          onChange={(e) => update("pixel", e.target.value)}
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 transition-opacity"
      >
        Review campaign
      </button>
    </form>
  );
}
