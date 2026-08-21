"use client";

import { useState } from "react";
import { type ClientData } from "@/lib/dashboard/csm-clients-types";
import { getStatusDisplay } from "@/lib/dashboard/health-scoring";
import { OverviewTab } from "./tabs/overview-tab";
import { CreativesTab } from "./tabs/creatives-tab";
import { CampaignsTab } from "./tabs/campaigns-tab";
import { Phase3StatusTab } from "./tabs/phase3-status-tab";

interface ClientDetailModalProps {
  client: ClientData;
  onClose: () => void;
}

type Tab = "overview" | "creatives" | "campaigns" | "phase3";

export function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const statusDisplay = getStatusDisplay(client.health.status);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "creatives", label: "Creatives" },
    { id: "campaigns", label: "Campaigns" },
    { id: "phase3", label: "Meta Setup (Phase 3)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-40 border-b border-line bg-surface px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-ink">{client.name}</h2>
              <p className="text-sm text-ink-3">{client.ghl_location_id}</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-2 justify-end ${statusDisplay.color} mb-2`}>
                <span className="font-mono text-2xl">{statusDisplay.icon}</span>
                <div>
                  <p className="text-xs text-ink-3">Health</p>
                  <p className="font-semibold">{client.health.score}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-sm text-ink-3 hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2 border-b border-line -mx-6 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === "overview" && <OverviewTab client={client} />}
          {activeTab === "creatives" && <CreativesTab client={client} />}
          {activeTab === "campaigns" && <CampaignsTab client={client} />}
          {activeTab === "phase3" && <Phase3StatusTab client={client} />}
        </div>
      </div>
    </div>
  );
}
