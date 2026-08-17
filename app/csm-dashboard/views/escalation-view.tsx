"use client";

import { type ClientData, type EscalationBucket } from "@/lib/dashboard/csm-clients-types";
import { Panel, Badge } from "../../ui";

const BUCKET_META: Record<EscalationBucket, { title: string; tone: "ok" | "danger" | "neutral" }> = {
  "ascension-ready": { title: "Ascension Ready", tone: "ok" },
  "at-risk": { title: "At Risk", tone: "danger" },
  "no-action-needed": { title: "No Action Needed", tone: "neutral" },
};

const BUCKET_ORDER: EscalationBucket[] = ["at-risk", "ascension-ready", "no-action-needed"];

interface EscalationViewProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
}

/** Story 3.6 — filtered portfolio view: who's ready to grow, who's at risk, who needs nothing right now. */
export function EscalationView({ clients, onSelectClient }: EscalationViewProps) {
  const buckets: Record<EscalationBucket, ClientData[]> = {
    "ascension-ready": [],
    "at-risk": [],
    "no-action-needed": [],
  };
  for (const client of clients) {
    buckets[client.escalation.bucket].push(client);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {BUCKET_ORDER.map((bucket) => {
        const meta = BUCKET_META[bucket];
        const bucketClients = buckets[bucket];
        return (
          <Panel key={bucket} title={meta.title} meta={<Badge tone={meta.tone}>{bucketClients.length}</Badge>}>
            {bucketClients.length === 0 ? (
              <p className="text-sm text-ink-3">None right now.</p>
            ) : (
              <ul className="space-y-2">
                {bucketClients.map((client) => (
                  <li key={client.id}>
                    <button
                      onClick={() => onSelectClient(client)}
                      className="w-full rounded-md border border-line px-3 py-2 text-left transition-colors hover:bg-raised"
                    >
                      <p className="truncate text-sm font-medium text-ink">{client.name}</p>
                      {client.escalation.reason && (
                        <p className="truncate text-xs text-ink-3">{client.escalation.reason}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
