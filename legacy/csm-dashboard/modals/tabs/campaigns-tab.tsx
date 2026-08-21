"use client";

import { useEffect, useState } from "react";
import { type ClientData } from "@/lib/dashboard/csm-clients-types";
import { type CampaignWithCreativeCount } from "../../actions/get-campaigns-with-creatives";
import { getCampaignsWithCreativesForClient } from "../../actions/get-campaigns-with-creatives";

interface CampaignsTabProps {
  client: ClientData;
}

export function CampaignsTab({ client }: CampaignsTabProps) {
  const [campaigns, setCampaigns] = useState<CampaignWithCreativeCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      setLoading(true);
      setError(null);
      const result = await getCampaignsWithCreativesForClient(client.id);
      if (result.error) {
        setError(result.error.message);
      } else {
        setCampaigns(result.data);
      }
      setLoading(false);
    }

    fetchCampaigns();
  }, [client.id]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-ink-3">Loading campaigns...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-tint p-4">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-sunken p-6 text-center">
        <p className="text-sm text-ink-3">No active campaigns found</p>
        <p className="text-xs text-ink-3 mt-2">Campaigns will appear here once they&apos;re launched in Meta Ads Manager</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignWithCreativeCount }) {
  const statusColors = {
    ACTIVE: "bg-ok-tint text-ok border-ok/30",
    PAUSED: "bg-warn-tint text-warn border-warn/30",
    ARCHIVED: "bg-ink-tint text-ink-2 border-line",
    DELETED: "bg-danger-tint text-danger border-danger/30",
  };

  const statusColor = statusColors[campaign.status];

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-ink">{campaign.name}</h4>
            {campaign.creative_count > 0 && (
              <span className="rounded-full bg-accent/20 text-accent px-2 py-1 text-xs font-medium">
                {campaign.creative_count} creative{campaign.creative_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-3 mt-1">{campaign.id}</p>
        </div>
        <span className={`rounded px-2 py-1 text-xs font-medium border ${statusColor}`}>
          {campaign.status}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">Spend (24h)</p>
          <p className="text-sm font-semibold text-ink">${campaign.spend_24h.toFixed(2)}</p>
        </div>
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">Impressions</p>
          <p className="text-sm font-semibold text-ink">{campaign.impressions_24h.toLocaleString()}</p>
        </div>
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">Clicks</p>
          <p className="text-sm font-semibold text-ink">{campaign.clicks_24h.toLocaleString()}</p>
        </div>
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">Leads</p>
          <p className="text-sm font-semibold text-ink">{campaign.leads_24h.toLocaleString()}</p>
        </div>
      </div>

      {campaign.costPerConversion24h !== undefined && (
        <div className="text-xs text-ink-2">
          Cost per conversion (24h):{" "}
          <span className="font-semibold text-ink">${campaign.costPerConversion24h.toFixed(2)}</span>
        </div>
      )}

      <div className="text-xs text-ink-3 mt-3">
        Created: {new Date(campaign.created_time).toLocaleDateString()}
      </div>
    </div>
  );
}
