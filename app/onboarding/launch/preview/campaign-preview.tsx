import Link from "next/link";
import { Panel, Badge } from "../../../ui";
import type { CampaignTemplate } from "@/lib/onboarding/campaign-templates";

export type ReviewedCampaign = {
  client: string;
  offer: string;
  budget: number;
  cap: number;
  pixel: string;
};

export function CampaignPreview({
  campaign,
  template,
  editHref,
}: {
  campaign: ReviewedCampaign;
  template: CampaignTemplate;
  editHref: string;
}) {
  const campaignName = `${campaign.client} — ${template.offerLabel}`;
  const adSetName = `${campaign.client} — ${template.offerLabel} traffic`;

  const query = new URLSearchParams({
    client: campaign.client,
    offer: campaign.offer,
    budget: String(campaign.budget),
    cap: String(campaign.cap),
    pixel: campaign.pixel,
  }).toString();

  return (
    <div className="space-y-6">
      <Panel title="Campaign" meta={<Badge tone="neutral">Paused on create</Badge>}>
        <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
          <dt className="text-ink-3">Campaign name</dt>
          <dd className="text-ink">{campaignName}</dd>

          <dt className="text-ink-3">Ad set name</dt>
          <dd className="text-ink">{adSetName}</dd>

          <dt className="text-ink-3">Targeting</dt>
          <dd className="text-ink">{template.adSetTargeting}</dd>

          <dt className="text-ink-3">Monthly budget</dt>
          <dd className="text-ink tabular-nums">${campaign.budget.toLocaleString()}</dd>

          <dt className="text-ink-3">Daily cap</dt>
          <dd className="text-ink tabular-nums">${campaign.cap.toLocaleString()}</dd>

          <dt className="text-ink-3">Pixel ID</dt>
          <dd className="text-ink">
            {campaign.pixel}{" "}
            <span className="text-xs text-ink-3">(not verified against Meta)</span>
          </dd>
        </dl>
      </Panel>

      <Panel title="Creatives" meta={`${template.creatives.length} in template`}>
        {template.creatives.length === 0 ? (
          <p className="text-sm text-ink-3">
            No creatives on file for this offer yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {template.creatives.map((creative) => (
              <div
                key={creative.id}
                className="h-24 w-24 overflow-hidden rounded-md border border-line bg-raised"
              >
                {creative.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creative.thumbnailUrl}
                    alt={`Creative ${creative.id}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-ink-3">
                    No thumbnail
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="flex items-center gap-3">
        <Link
          href={`/onboarding/launch/activate?${query}`}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 transition-opacity"
        >
          Looks good — confirm
        </Link>
        <Link
          href={editHref}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-raised"
        >
          Edit
        </Link>
        <Link
          href="/onboarding"
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-raised"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
