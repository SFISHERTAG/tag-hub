"use client";

import { useState } from "react";
import { type ClientData, type EscalationBucket } from "@/lib/dashboard/csm-clients-types";
import { enterImpersonation } from "@/lib/auth/impersonation-actions";
import { Panel, Badge } from "../../ui";

const BUCKET_META: Record<EscalationBucket, { title: string; tone: "ok" | "danger" | "neutral" }> = {
  "ascension-ready": { title: "Ascension Ready", tone: "ok" },
  "at-risk": { title: "At Risk", tone: "danger" },
  "no-action-needed": { title: "No Action Needed", tone: "neutral" },
};

const BUCKET_ORDER: EscalationBucket[] = ["at-risk", "ascension-ready", "no-action-needed"];

// "Stage" isn't wired into ClientData yet (3.1's GHL pipeline-stage integration is
// still an open task) — health status is the closest thing to a stage today.
const STATUS_RANK: Record<ClientData["health"]["status"], number> = {
  critical: 0,
  alert: 1,
  "at-risk": 2,
  healthy: 3,
  excellent: 4,
};

type SortKey = "stage" | "checkin";

interface EscalationViewProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
}

function sortClients(clients: ClientData[], sortKey: SortKey): ClientData[] {
  const sorted = [...clients];
  if (sortKey === "stage") {
    sorted.sort((a, b) => STATUS_RANK[a.health.status] - STATUS_RANK[b.health.status]);
  } else {
    // Nulls (no check-in on record — fresh onboarding) sort last, not first.
    sorted.sort((a, b) => {
      const aDays = a.escalation.daysSinceLastCheckIn;
      const bDays = b.escalation.daysSinceLastCheckIn;
      if (aDays === null && bDays === null) return 0;
      if (aDays === null) return 1;
      if (bDays === null) return -1;
      return bDays - aDays;
    });
  }
  return sorted;
}

/** Story 3.6 — filtered portfolio view: who's ready to grow, who's at risk, who needs nothing right now. */
export function EscalationView({ clients, onSelectClient }: EscalationViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("checkin");

  const buckets: Record<EscalationBucket, ClientData[]> = {
    "ascension-ready": [],
    "at-risk": [],
    "no-action-needed": [],
  };
  for (const client of clients) {
    buckets[client.escalation.bucket].push(client);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-ink-2">Sort by:</span>
        {(["checkin", "stage"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              sortKey === key
                ? "bg-accent text-background"
                : "border border-line/50 bg-sunken text-ink-2 hover:bg-surface"
            }`}
          >
            {key === "checkin" ? "Days since check-in" : "Stage"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {BUCKET_ORDER.map((bucket) => {
          const meta = BUCKET_META[bucket];
          const bucketClients = sortClients(buckets[bucket], sortKey);
          return (
            <Panel key={bucket} title={meta.title} meta={<Badge tone={meta.tone}>{bucketClients.length}</Badge>}>
              {bucketClients.length === 0 ? (
                <p className="text-sm text-ink-3">None right now.</p>
              ) : (
                <ul className="space-y-2">
                  {bucketClients.map((client) => (
                    <li key={client.id} className="rounded-md border border-line px-3 py-2">
                      <button
                        onClick={() => onSelectClient(client)}
                        className="w-full text-left"
                      >
                        <p className="truncate text-sm font-medium text-ink">{client.name}</p>
                        {client.escalation.reason && (
                          <p className="truncate text-xs text-ink-3">{client.escalation.reason}</p>
                        )}
                        <p className="truncate text-xs text-ink-3">
                          {client.escalation.daysSinceLastCheckIn === null
                            ? "No check-in yet (fresh onboarding)"
                            : `Last check-in ${client.escalation.daysSinceLastCheckIn}d ago`}
                        </p>
                      </button>
                      <form action={enterImpersonation.bind(null, client.ghl_location_id)} className="mt-2">
                        <button
                          type="submit"
                          className="w-full rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-ink hover:bg-raised"
                        >
                          Enter tenant
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
