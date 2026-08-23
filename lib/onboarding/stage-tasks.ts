// Client-safe: no server-only imports.

/**
 * Fulfillment stages, in pipeline order. Matches the GHL stage names on the
 * Fulfillment pipeline (see lib/ghl/pipelines.ts's note on the three "stage"
 * concepts in this codebase).
 *
 * Updated 2026-08-23: GHL Fulfillment pipeline was rebuilt with twelve new
 * stages, replacing the PR1-AP5 model. Old codes retained for backward
 * compatibility with existing opportunities; new codes map to live GHL stages.
 *
 * Old stages (archived, for existing data):
 * - PR1, PR2, AP1, AP2, AP3, AP4, AP5
 *
 * New stages (live on GHL 2026-08-22+):
 * - OB: Onboarding Booked (was PR1)
 * - OC: Onboarding Complete (was PR2)
 * - TP: Tech Stack Provisioned
 * - IC: Intake Complete
 * - CC: Creative Copy Complete
 * - CR: Creatives Complete [note: "Compete" in GHL is a typo for "Complete"]
 * - EC: Editing Complete
 * - CL: Campaign Launched (was AP2)
 * - FA: First Appointment Booked (was AP3)
 * - DC: Deal Closed (was AP4)
 * - AS: Ascension (was AP5)
 * - OFF: Offboarded
 */
export const FULFILLMENT_STAGE_ORDER = [
  // Old stages (archived, for existing data)
  "PR1",
  "PR2",
  "AP1",
  "AP2",
  "AP3",
  "AP4",
  "AP5",
  // New stages (live on GHL)
  "OB",
  "OC",
  "TP",
  "IC",
  "CC",
  "CR",
  "EC",
  "CL",
  "FA",
  "DC",
  "AS",
  "OFF",
] as const;

export type FulfillmentStage = (typeof FULFILLMENT_STAGE_ORDER)[number];

export function isFulfillmentStage(value: string): value is FulfillmentStage {
  return (FULFILLMENT_STAGE_ORDER as readonly string[]).includes(value);
}

/**
 * Pulls the stage code out of a real GHL stage name.
 *
 * 2026-08-23: GHL rebuilt the Fulfillment pipeline with new stage names. This
 * function accepts three formats:
 * 1. New English names: "Campaign Launched" → CL, "Onboarding Booked" → OB
 * 2. Old format: "AP 2 - Ads Launched" or "PR1" → AP2, PR1
 * 3. Bare codes: "AP2" or "OB" → if valid stage code, return as-is
 *
 * Anchored at start so unrelated stages don't masquerade as FulfillmentStages.
 */
const OLD_STAGE_PATTERN = /^(PR|AP)\s*[-–—.]?\s*([1-9])\b/i;

/**
 * Maps new GHL stage names to stage codes. Case-insensitive.
 */
const NEW_STAGE_NAME_MAP: Record<string, FulfillmentStage> = {
  "onboarding booked": "OB",
  "onboarding complete": "OC",
  "tech stack provisioned": "TP",
  "intake complete": "IC",
  "creative copy complete": "CC",
  "creatives compete": "CR", // GHL has "compete" (typo for "complete")
  "creatives complete": "CR", // Accept the corrected name
  "editing complete": "EC",
  "campaign launched": "CL",
  "first appointment booked": "FA",
  "1st deal closed": "DC",
  "deal closed": "DC", // Accept variant
  "ascension": "AS",
  "offboarded": "OFF",
};

export function parseFulfillmentStage(stageName: string | null | undefined): FulfillmentStage | null {
  if (!stageName) return null;

  const trimmed = stageName.trim();
  const normalized = trimmed.toLowerCase();

  // Try new stage name format first (case-insensitive full name)
  if (normalized in NEW_STAGE_NAME_MAP) {
    return NEW_STAGE_NAME_MAP[normalized];
  }

  // Try bare code format (PR1, AP2, OB, CL, etc.)
  if (isFulfillmentStage(trimmed.toUpperCase())) {
    return trimmed.toUpperCase() as FulfillmentStage;
  }

  // Fall back to old format with separators (PR 1 - Kickoff, AP2 - Ads Launched)
  const match = OLD_STAGE_PATTERN.exec(trimmed);
  if (match) {
    const code = `${match[1].toUpperCase()}${match[2]}`;
    return isFulfillmentStage(code) ? (code as FulfillmentStage) : null;
  }

  return null;
}

export type OnboardingTask = {
  id: string;
  label: string;
};

/**
 * Fixed stage -> task mapping for MVP (Dev notes on story 5.1). Per-client
 * customization is a fast-follow, not this story.
 *
 * Updated 2026-08-23 for new GHL stage model. Includes both old (PR1-AP5,
 * archived) and new (OB-OFF, live) mappings for backward compatibility.
 */
export const STAGE_TASKS: Record<FulfillmentStage, OnboardingTask[]> = {
  // Old stages (archived, for existing data)
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
  // New stages (live on GHL 2026-08-22+)
  OB: [
    { id: "ob-fund-account", label: "Fund the account" },
    { id: "ob-collect-assets", label: "Collect brand assets and offer details" },
  ],
  OC: [
    { id: "oc-build-funnel", label: "Build the funnel" },
    { id: "oc-test-funnel", label: "Test the funnel end to end" },
    { id: "oc-confirm-tracking", label: "Confirm pixel and tracking fire correctly" },
  ],
  TP: [
    { id: "tp-tech-ready", label: "Tech stack validated" },
  ],
  IC: [
    { id: "ic-intake-complete", label: "Client intake complete" },
  ],
  CC: [
    { id: "cc-copy-ready", label: "Creative copy approved" },
  ],
  CR: [
    { id: "cr-creatives-ready", label: "Creative assets finalized" },
  ],
  EC: [
    { id: "ec-meta-partner", label: "Client partners ad account with TAG's Business Manager" },
    { id: "ec-meta-system", label: "TAG assigns ad account to tag-hub-server System User" },
    { id: "ec-create-campaign", label: "Create campaign (paused)" },
  ],
  CL: [
    { id: "cl-launch-campaign", label: "Launch campaign" },
  ],
  FA: [
    { id: "fa-review-performance", label: "Review initial performance" },
  ],
  DC: [
    { id: "dc-first-deal", label: "First deal closed" },
  ],
  AS: [
    { id: "as-ascension", label: "Ascension plan" },
  ],
  OFF: [
    { id: "off-exit", label: "Client offboarded" },
  ],
};
