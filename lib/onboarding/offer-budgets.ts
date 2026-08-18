// Client-safe: no server-only imports.
//
// Story 5.6 AC1: each offer has a max monthly spend, hardcoded for MVP.
// Keyed by the same offer id CAMPAIGN_TEMPLATES uses (lib/onboarding/campaign-templates.ts),
// since that's the id createPausedCampaign receives as templateId.

export const OFFER_MAX_MONTHLY_BUDGET: Record<string, number> = {
  "tax-return-prep": 2000,
  bookkeeping: 1500,
  "tax-resolution": 2500,
};

/** Returns the max budget for an offer, or undefined if the offer isn't configured with one. */
export function getMaxMonthlyBudget(offerId: string): number | undefined {
  return OFFER_MAX_MONTHLY_BUDGET[offerId];
}
