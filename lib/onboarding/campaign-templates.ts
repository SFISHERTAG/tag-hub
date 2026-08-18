// Client-safe: no server-only imports. Hardcoded per 5.2's Dev notes
// ("offer list, MVP: hardcoded, dynamically managed later").

export type CampaignTemplate = {
  id: string;
  offerLabel: string;
  adSetTargeting: string;
  creatives: { id: string; thumbnailUrl?: string }[];
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "tax-return-prep",
    offerLabel: "Tax return prep",
    adSetTargeting: "US, 30-65, homeowners, income $75k+, interest: tax planning",
    creatives: [
      { id: "trp-1", thumbnailUrl: "/onboarding/creatives/tax-return-prep-1.jpg" },
      { id: "trp-2", thumbnailUrl: "/onboarding/creatives/tax-return-prep-2.jpg" },
    ],
  },
  {
    id: "bookkeeping",
    offerLabel: "Bookkeeping",
    adSetTargeting: "US, small business owners, 25-60, interest: QuickBooks, payroll",
    creatives: [{ id: "bk-1", thumbnailUrl: "/onboarding/creatives/bookkeeping-1.jpg" }],
  },
  {
    id: "tax-resolution",
    offerLabel: "Tax resolution",
    adSetTargeting: "US, 35-70, interest: IRS debt relief, back taxes",
    creatives: [],
  },
];

export function getCampaignTemplate(offerId: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === offerId);
}
