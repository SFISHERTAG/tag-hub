"use client";

import { useState, useTransition } from "react";
import { saveTenantAction } from "../actions";
import type { Service, Tenant } from "@/lib/ghl/tenants";

const SERVICE_LABELS: Record<Service, string> = {
  vslFunnel: "VSL funnel",
  adManagement: "Ad management",
  closingTeam: "Closing team",
  website: "Website",
  salesEnablement: "Sales enablement",
};

const SERVICES = Object.keys(SERVICE_LABELS) as Service[];

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent disabled:opacity-60";

export function TenantForm({ tenant }: { tenant: Tenant }) {
  const [services, setServices] = useState(tenant.services);
  const [ownerModel, setOwnerModel] = useState(tenant.ownerModel);
  const [metaAdAccountId, setMetaAdAccountId] = useState(tenant.metaAdAccountId ?? "");
  const [metaBusinessId, setMetaBusinessId] = useState(tenant.metaBusinessId ?? "");
  const [metaPixelId, setMetaPixelId] = useState(tenant.metaPixelId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveTenantAction(tenant.locationId, {
        services,
        ownerModel,
        metaAdAccountId,
        metaBusinessId,
        metaPixelId,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-ink">Services</h3>
          <p className="mt-1 text-xs text-ink-3">
            Controls what this tenant sees. A service off here should hide the
            corresponding nav route and return 404 if typed directly.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICES.map((service) => (
              <label
                key={service}
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink-2 hover:bg-raised"
              >
                <input
                  type="checkbox"
                  checked={services[service]}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setServices((prev) => ({ ...prev, [service]: checked }));
                  }}
                  className="h-4 w-4 rounded border-line-strong"
                />
                {SERVICE_LABELS[service]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink">Owner model</h3>
          <p className="mt-1 text-xs text-ink-3">
            Who this tenant is run by — affects offboarding and Meta asset
            ownership.
          </p>
          <select
            value={ownerModel}
            onChange={(e) => setOwnerModel(e.currentTarget.value as Tenant["ownerModel"])}
            className={`${inputClass} mt-2 max-w-xs`}
          >
            <option value="client">Client</option>
            <option value="tag">TAG</option>
          </select>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink">Meta ids</h3>
          <p className="mt-1 text-xs text-ink-3">
            Unused until Epic 4. Leave blank until Meta setup for this tenant
            is complete.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-xs text-ink-3">Ad account id</label>
              <input
                value={metaAdAccountId}
                onChange={(e) => setMetaAdAccountId(e.currentTarget.value)}
                placeholder="act_…"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-ink-3">Business id</label>
              <input
                value={metaBusinessId}
                onChange={(e) => setMetaBusinessId(e.currentTarget.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-ink-3">Pixel id</label>
              <input
                value={metaPixelId}
                onChange={(e) => setMetaPixelId(e.currentTarget.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && <p className="text-sm text-ok">Saved.</p>}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
