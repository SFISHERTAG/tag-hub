"use client";

import { useEffect, useState } from "react";
import { Panel } from "../ui";
import { SampleDataBanner } from "../dashboard/widgets/sample-data-banner";
import { filterClients, type ClientData } from "@/lib/dashboard/csm-clients-types";
import { getAssignedClientsForCSM } from "./actions/get-assigned-clients";
import { GridView } from "./views/grid-view";
import { ListView } from "./views/list-view";
import { KanbanView } from "./views/kanban-view";
import { EscalationView } from "./views/escalation-view";
import { ClientDetailModal } from "./modals/client-detail-modal";

type ViewMode = "grid" | "list" | "kanban" | "escalations";
type StatusFilter = "all" | "excellent" | "healthy" | "at-risk" | "critical" | "alert";
type SortBy = "name" | "health" | "roas" | "spend";

export function CSMPortfolio({
  csmEmail,
  userRole,
  initialView,
}: {
  csmEmail: string;
  userRole: string;
  initialView?: ViewMode;
}) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView ?? "grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const result = await getAssignedClientsForCSM(csmEmail);
      if (result.error) {
        setError(result.error.message);
        setClients([]);
      } else {
        setError(null);
        setClients(result.data);
      }
      setLoading(false);
    }

    fetchData();
  }, [csmEmail]);

  const filteredClients = filterClients(clients, {
    search: searchQuery,
    statusFilter,
    sortBy,
    sortOrder,
  });

  const handleSortToggle = (newSort: SortBy) => {
    if (sortBy === newSort) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSort);
      setSortOrder("asc");
    }
  };

  const ViewComponent = {
    grid: GridView,
    list: ListView,
    kanban: KanbanView,
    escalations: EscalationView,
  }[viewMode];

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">CSM Dashboard</h1>
          <p className="text-sm text-ink-2">Manage {clients.length} assigned clients</p>
        </div>

        <SampleDataBanner message="Sample data — every client's health score, ROAS, spend, and escalation status below is a placeholder shaped like the real thing, not a live reading. Live numbers ship with the Meta integration." />

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
            Couldn&apos;t load your client list: {error}. This is not the same as having zero clients — try
            refreshing.
          </div>
        )}

        {/* Controls */}
        <Panel className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-accent focus:outline-none"
            />

            {/* View Selector */}
            <div className="flex gap-2">
              {(["grid", "list", "kanban", "escalations"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? "bg-accent text-background"
                      : "border border-line bg-surface text-ink hover:bg-raised"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            {/* Status Filter */}
            <div className="flex gap-2">
              <span className="text-xs font-medium text-ink-2 self-center">Status:</span>
              {(["all", "excellent", "healthy", "at-risk", "critical", "alert"] as StatusFilter[]).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? "bg-accent text-background"
                        : "border border-line/50 bg-sunken text-ink-2 hover:bg-surface"
                    }`}
                  >
                    {status.replace("-", " ")}
                  </button>
                ),
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex gap-2">
              <span className="text-xs font-medium text-ink-2 self-center">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortToggle(e.target.value as SortBy)}
                className="rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-ink"
              >
                <option value="name">Name</option>
                <option value="health">Health Score</option>
                <option value="roas">ROAS</option>
                <option value="spend">Spend</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-ink hover:bg-raised"
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-sm text-ink-2">Loading clients...</div>
        </div>
      ) : filteredClients.length === 0 ? (
        <Panel className="text-center py-12">
          <p className="text-sm text-ink-2">
            {clients.length === 0 ? "No clients assigned yet." : "No clients match your filters."}
          </p>
        </Panel>
      ) : (
        <ViewComponent
          clients={filteredClients}
          onSelectClient={setSelectedClient}
        />
      )}

      {/* Detail Modal */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}
