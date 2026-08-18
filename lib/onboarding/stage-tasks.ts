// Client-safe: no server-only imports.

/**
 * Fulfillment stages, in pipeline order. Matches the GHL stage names on the
 * Fulfillment pipeline (see lib/ghl/pipelines.ts's note on the three "stage"
 * concepts in this codebase).
 */
export const FULFILLMENT_STAGE_ORDER = [
  "PR1",
  "PR2",
  "AP1",
  "AP2",
  "AP3",
  "AP4",
  "AP5",
] as const;

export type FulfillmentStage = (typeof FULFILLMENT_STAGE_ORDER)[number];

export function isFulfillmentStage(value: string): value is FulfillmentStage {
  return (FULFILLMENT_STAGE_ORDER as readonly string[]).includes(value);
}

export type OnboardingTask = {
  id: string;
  label: string;
};

/**
 * Fixed stage -> task mapping for MVP (Dev notes on story 5.1). Per-client
 * customization is a fast-follow, not this story.
 */
export const STAGE_TASKS: Record<FulfillmentStage, OnboardingTask[]> = {
  PR1: [
    { id: "pr1-fund-account", label: "Fund the account" },
    { id: "pr1-collect-assets", label: "Collect brand assets and offer details" },
    { id: "pr1-build-funnel", label: "Build the funnel" },
  ],
  PR2: [
    { id: "pr2-test-funnel", label: "Test the funnel end to end" },
    { id: "pr2-confirm-tracking", label: "Confirm pixel and tracking fire correctly" },
  ],
  AP1: [
    // Two-step process, documented in docs/meta-live-launch-plan.md: the
    // client partners their ad account with TAG's Business Manager first
    // (Business Settings -> Partners, client's side), then TAG assigns it to
    // the tag-hub-server System User (Business Settings -> System Users ->
    // Add Assets -> Ad Accounts, TAG's side). Partner access alone does not
    // let tag-hub-server run the Marketing API calls story 5.4 needs against
    // metaAdAccountId - confirmed during story 4.1.
    { id: "ap1-connect-meta-partner", label: "Client partners ad account with TAG's Business Manager" },
    { id: "ap1-connect-meta-system-user", label: "TAG assigns ad account to tag-hub-server System User" },
    { id: "ap1-create-paused-campaign", label: "Create campaign (paused)" },
  ],
  AP2: [
    { id: "ap2-launch-campaign", label: "Launch campaign" },
  ],
  AP3: [
    { id: "ap3-review-performance", label: "Review initial performance" },
  ],
  AP4: [
    { id: "ap4-upsell-review", label: "Up-sell review" },
  ],
  AP5: [
    { id: "ap5-ascension-plan", label: "Ascension plan" },
  ],
};
