import { Panel, Badge } from "../../ui";
import type { ClientData } from "@/lib/dashboard/csm-clients-types";
import { getStatusDisplay } from "@/lib/dashboard/health-scoring";

const STATUS_TONE: Record<ClientData["health"]["status"], "ok" | "warn" | "danger"> = {
  excellent: "ok",
  healthy: "ok",
  "at-risk": "warn",
  critical: "danger",
  alert: "danger",
};

export function PortfolioWidget({ clients }: { clients: ClientData[] }) {
  if (clients.length === 0) {
    return (
      <Panel title="Portfolio">
        <p className="text-sm text-ink-3">No clients in view yet.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Portfolio" meta={`${clients.length} ${clients.length === 1 ? "client" : "clients"}`}>
      <ol className="space-y-1.5">
        {clients.slice(0, 8).map((client) => (
          <li
            key={client.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <span className="truncate text-sm font-medium text-ink">{client.name}</span>
            <Badge tone={STATUS_TONE[client.health.status]}>
              {getStatusDisplay(client.health.status).label}
            </Badge>
          </li>
        ))}
      </ol>
      {clients.length > 8 && (
        <p className="mt-2 text-xs text-ink-3">+{clients.length - 8} more</p>
      )}
    </Panel>
  );
}
