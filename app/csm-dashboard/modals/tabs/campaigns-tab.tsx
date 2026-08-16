"use client";

import { type ClientData } from "@/lib/dashboard/csm-clients";

interface CampaignsTabProps {
  client: ClientData;
}

export function CampaignsTab({ client }: CampaignsTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 p-8 text-center">
        <p className="text-lg font-medium text-ink mb-2">Campaigns Coming Soon</p>
        <p className="text-sm text-ink-2 mb-4">
          Meta Ads integration (read-only view of active campaigns) will be available in Phase 2.
        </p>
        <div className="inline-block rounded-lg bg-accent/10 px-4 py-2">
          <p className="text-xs text-accent font-medium">🚀 Phase 2: Meta Integration</p>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-sunken p-4">
        <h3 className="text-sm font-medium text-ink mb-2">What to expect:</h3>
        <ul className="space-y-2 text-sm text-ink-2">
          <li>• View all active Meta Ad campaigns</li>
          <li>• Monitor spend and performance metrics</li>
          <li>• See creatives used in each campaign</li>
          <li>• Track ROI by campaign</li>
        </ul>
      </div>
    </div>
  );
}
