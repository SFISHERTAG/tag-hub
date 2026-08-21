/**
 * Wire shapes for `/api/onboarding/*`.
 */

export interface OnboardingTask {
  readonly id: string;
  readonly label: string;
}

/**
 * `GET /api/onboarding/checklist` answers with one of three shapes, and the
 * discriminant is load-bearing.
 *
 * "No client selected" and "this client has no Fulfillment opportunity yet" are
 * ordinary states with their own copy, not failures. Collapsing them into an
 * error would render a red box over a perfectly normal situation — and would
 * teach people to ignore the red box.
 */
export interface ChecklistNoClient {
  readonly state: 'no-client';
  readonly stageOrder: readonly string[];
}

export interface ChecklistNoOpportunity {
  readonly state: 'no-opportunity';
  readonly locationId: string;
  readonly tenantName: string;
  readonly stageOrder: readonly string[];
}

export interface ChecklistReady {
  readonly state: 'ready';
  readonly locationId: string;
  readonly tenantName: string;
  readonly opportunityId: string;
  /**
   * Null when GHL's stage name does not parse. GHL labels a stage
   * "AP 2 - Ads Launched", not "AP2"; `parseFulfillmentStage` handles that
   * server-side, and a null here means genuinely unrecognised rather than
   * merely differently spelled.
   */
  readonly stage: string | null;
  readonly stageName: string | null;
  readonly daysInStage: number | null;
  readonly tasks: readonly OnboardingTask[];
  readonly completedTaskIds: readonly string[];
  /** Cosmetic. The endpoint re-checks the role on every write. */
  readonly readOnly: boolean;
  readonly stageOrder: readonly string[];
}

export type Checklist = ChecklistNoClient | ChecklistNoOpportunity | ChecklistReady;

/** The completed set read back from the store, not an echo of the request. */
export interface TaskSaved {
  readonly ok: true;
  readonly completedTaskIds: readonly string[];
}

export interface TaskToggle {
  readonly locationId: string;
  readonly opportunityId: string;
  readonly taskId: string;
  readonly complete: boolean;
}

/* ── Campaign launch ────────────────────────────────────────────────────── */

export interface CampaignCreative {
  readonly id: string;
  readonly thumbnailUrl?: string;
}

export interface CampaignTemplate {
  readonly id: string;
  readonly offerLabel: string;
  readonly adSetTargeting: string;
  readonly creatives: readonly CampaignCreative[];
}

export interface CampaignTemplateList {
  readonly templates: readonly CampaignTemplate[];
  /**
   * The exact sentence the activate endpoint rejects an unconfirmed call with.
   * Served rather than duplicated in this bundle so the warning a person reads
   * and the warning the API enforces cannot drift apart.
   */
  readonly activationWarning: string;
}

/** The five fields, as typed. Validation lives server-side; see the service. */
export interface CampaignFormInput {
  readonly client: string;
  readonly offer: string;
  readonly budget: string;
  readonly cap: string;
  readonly pixel: string;
}

export interface ParsedCampaign {
  readonly clientName: string;
  readonly offerId: string;
  readonly monthlyBudget: number;
  readonly dailyCap: number;
  readonly pixelId: string;
}

export interface CampaignPreview {
  readonly campaign: ParsedCampaign;
  readonly template: CampaignTemplate;
  readonly activationWarning: string;
}

/** A created campaign is PAUSED. `activated` is returned explicitly, and false. */
export interface CreatedCampaign {
  readonly campaignId: string;
  readonly adSetId: string;
  readonly adIds: readonly string[];
  readonly status: 'paused';
  readonly activated: false;
  readonly locationId: string;
  readonly activationWarning: string;
}

export interface ActivatedCampaign {
  readonly campaignId: string;
  readonly opportunityId: string;
  readonly stageId: string;
  readonly stageName: string;
  readonly activated: true;
}
