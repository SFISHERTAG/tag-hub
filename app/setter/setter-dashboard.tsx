"use client";

import { useEffect, useState } from "react";
import { Panel } from "../ui";
import { type LeadMetric, type SetterMetrics } from "@/lib/dashboard/speed-to-lead";

interface SetterDashboardProps {
  ghlLocationId: string;
  setterEmail: string;
  userRole: string;
  initialMetrics: SetterMetrics;
  initialLeads: LeadMetric[];
}

export function SetterDashboard({
  ghlLocationId,
  setterEmail,
  userRole,
  initialMetrics,
  initialLeads,
}: SetterDashboardProps) {
  const [metrics, setMetrics] = useState<SetterMetrics>(initialMetrics);
  const [leads, setLeads] = useState<LeadMetric[]>(initialLeads);
  const [filter, setFilter] = useState<"urgent" | "normal" | "aged">("urgent");

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/setter/metrics", {
          method: "POST",
          body: JSON.stringify({ setterEmail }),
        });
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
          setLeads(data.leads);
        }
      } catch (error) {
        console.error("Error fetching setter data:", error);
      }
    }

    if (ghlLocationId && setterEmail) {
      // Refresh every 10 seconds for real-time updates (speed to lead is critical)
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [ghlLocationId, setterEmail]);

  const filteredLeads = leads.filter((lead) => lead.priority === filter);

  const formatTime = (minutes?: number): string => {
    if (!minutes) return "-";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Setter Dashboard</h1>
        <p className="text-sm text-ink-2">
          Prioritize fresh leads (call within 2 min), work aged queue between hot calls
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Panel className="space-y-1">
          <div className="text-xs font-medium text-ink-3">Urgent (Fresh)</div>
          <div className="text-2xl font-bold text-warn">
            {leads.filter((l) => l.priority === "urgent" && l.status === "uncontacted").length}
          </div>
          <div className="text-xs text-ink-2">&lt;2 min old</div>
        </Panel>
        <Panel className="space-y-1">
          <div className="text-xs font-medium text-ink-3">Contacted</div>
          <div className="text-2xl font-bold text-good">{metrics.contactedToday}</div>
          <div className="text-xs text-ink-2">{metrics.contactRate}% contact rate</div>
        </Panel>
        <Panel className="space-y-1">
          <div className="text-xs font-medium text-ink-3">Avg Speed</div>
          <div className="text-2xl font-bold text-accent">
            {formatTime(metrics.averageSpeedMinutes)}
          </div>
          <div className="text-xs text-ink-2">Target: &lt;2 min</div>
        </Panel>
        <Panel className="space-y-1">
          <div className="text-xs font-medium text-ink-3">Aged Queue</div>
          <div className="text-2xl font-bold text-ink">
            {leads.filter((l) => l.priority === "aged").length}
          </div>
          <div className="text-xs text-ink-2">Callback list</div>
        </Panel>
      </div>

      {/* Urgent Leads Alert */}
      {leads.filter((l) => l.priority === "urgent" && l.status === "uncontacted").length >
        0 && (
        <Panel className="border-l-4 border-warn bg-warn/10 p-4">
          <div className="flex items-center gap-2">
            <div className="text-lg">🔴</div>
            <div>
              <div className="font-semibold text-warn">
                {leads.filter((l) => l.priority === "urgent" && l.status === "uncontacted")
                  .length}{" "}
                fresh leads waiting
              </div>
              <div className="text-xs text-ink-2">Call within 2 minutes</div>
            </div>
          </div>
        </Panel>
      )}

      {/* Leads Queue */}
      <div className="space-y-3">
        <Panel className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Lead Queue</h2>
            <div className="flex gap-2">
              {(["urgent", "normal", "aged"] as const).map((priority) => (
                <button
                  key={priority}
                  onClick={() => setFilter(priority as any)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    filter === priority
                      ? "bg-accent text-background"
                      : "border border-line/50 bg-sunken text-ink-2 hover:bg-surface"
                  }`}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-ink-2">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className={`flex items-center justify-between rounded border p-3 ${
                    lead.priority === "urgent" && lead.status === "uncontacted"
                      ? "border-warn bg-warn/5"
                      : "border-line bg-surface"
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{lead.name}</div>
                    <div className="text-xs text-ink-2">
                      {lead.email || lead.phone || "No contact info"}
                    </div>
                    <div className="text-xs text-ink-3 mt-1">
                      {lead.ageMinutes < 1 ? "Just in" : `${lead.ageMinutes}m ago`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-medium text-ink-3">Age</div>
                      <div
                        className={`text-sm font-semibold ${
                          lead.priority === "urgent" && lead.status === "uncontacted"
                            ? "text-warn"
                            : "text-ink"
                        }`}
                      >
                        {lead.ageMinutes}m
                      </div>
                    </div>
                    <div
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        lead.status === "uncontacted"
                          ? lead.priority === "urgent"
                            ? "bg-warn text-background"
                            : "bg-ink/20 text-ink"
                          : "bg-good/20 text-good"
                      }`}
                    >
                      {lead.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center">
        <p className="text-xs text-ink-3">Auto-refreshing every 10 seconds</p>
      </div>
    </div>
  );
}
