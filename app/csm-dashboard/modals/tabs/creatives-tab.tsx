"use client";

import { useEffect, useState } from "react";
import { type ClientData } from "@/lib/dashboard/csm-clients-types";
import { getCreativesWithCampaigns, type CreativeWithCampaigns } from "../../actions/get-creatives-with-campaigns";

interface CreativesTabProps {
  client: ClientData;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  "pending-approval": "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function CreativesTab({ client }: CreativesTabProps) {
  const [creatives, setCreatives] = useState<CreativeWithCampaigns[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await getCreativesWithCampaigns(client.id, client.ghl_location_id);
      setCreatives(data);
      setLoading(false);
    }

    fetchData();
  }, [client.id, client.ghl_location_id]);

  const groupedByStatus = {
    draft: creatives.filter((c) => c.status === "draft"),
    "pending-approval": creatives.filter((c) => c.status === "pending-approval"),
    approved: creatives.filter((c) => c.status === "approved"),
    rejected: creatives.filter((c) => c.status === "rejected"),
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 p-6 text-center">
        <p className="text-sm font-medium text-ink mb-2">Upload New Creative</p>
        <p className="text-xs text-ink-3 mb-4">
          Drag and drop or click to select files from Google Drive
        </p>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent/90 transition-colors">
          Browse Files
        </button>
      </div>

      {/* Status Tabs */}
      {loading ? (
        <p className="text-sm text-ink-3">Loading creatives...</p>
      ) : creatives.length === 0 ? (
        <div className="rounded-lg border border-line bg-sunken p-6 text-center">
          <p className="text-sm text-ink-3">No creatives uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByStatus).map(([status, items]) => (
            items.length > 0 && (
              <div key={status}>
                <h3 className="mb-3 text-sm font-semibold text-ink capitalize">
                  {status.replace("-", " ")} ({items.length})
                </h3>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  {items.map((creative) => (
                    <CreativeCard key={creative.id} creative={creative} />
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function CreativeCard({ creative }: { creative: CreativeWithCampaigns }) {
  const statusColor = STATUS_COLORS[creative.status] || "bg-gray-100 text-gray-700";
  const campaignCount = creative.campaigns_using?.length || 0;

  return (
    <a
      href={creative.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-lg border border-line bg-surface p-3 transition-all hover:border-accent hover:shadow-md"
    >
      <div className="mb-2 aspect-video rounded bg-sunken flex items-center justify-center">
        <span className="text-4xl">
          {creative.format === "video" ? "🎬" : creative.format === "image" ? "🖼" : "📄"}
        </span>
      </div>
      <h4 className="truncate text-sm font-medium text-ink group-hover:text-accent">
        {creative.title}
      </h4>
      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`rounded px-2 py-1 text-xs font-medium ${statusColor}`}>
            {creative.status.replace("-", " ")}
          </span>
          <span className="text-xs text-ink-3">{creative.platform}</span>
        </div>
        {campaignCount > 0 && (
          <div className="rounded bg-accent/10 px-2 py-1">
            <p className="text-xs text-accent font-medium">
              Used in {campaignCount} campaign{campaignCount !== 1 ? "s" : ""}
            </p>
            {creative.campaigns_using && creative.campaigns_using.length > 0 && (
              <div className="mt-1 space-y-1">
                {creative.campaigns_using.slice(0, 2).map((campaign) => (
                  <div key={campaign.campaignId} className="text-xs text-accent/80">
                    {campaign.campaignName}
                  </div>
                ))}
                {creative.campaigns_using.length > 2 && (
                  <div className="text-xs text-accent/60">
                    +{creative.campaigns_using.length - 2} more
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </a>
  );
}
