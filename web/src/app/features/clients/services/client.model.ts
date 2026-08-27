/**
 * The wire shapes of `/api/clients/**` and the four client-backed widget
 * endpoints under `/api/dashboard/widgets/**`, mirrored from the route files so
 * a change on either side is a compile error rather than an `undefined` at
 * runtime.
 *
 * Nothing in this file is a security boundary. Every endpoint re-checks the
 * caller's role server-side and derives the book from `session.email`; there is
 * no id here a caller could substitute to widen what they see. The one
 * caller-supplied identifier that exists — `csmEmail` — only selects *whose*
 * book, and only for staff roles the API has already admitted.
 *
 * `SampleDataDisclosure` is re-exported rather than declared: it moved to
 * `shared/ui` when a second feature needed it, and it is genuinely part of
 * these payloads, so the shapes below stay readable in one place.
 */

import type { SampleDataDisclosure } from '../../../shared/ui';

export type { SampleDataDisclosure };

export type ClientStatus = 'excellent' | 'healthy' | 'at-risk' | 'critical' | 'alert';

export type EscalationBucket = 'ascension-ready' | 'at-risk' | 'no-action-needed';

export interface ClientHealth {
  readonly clientId: string;
  readonly score: number;
  readonly status: ClientStatus;
  readonly roas_score: number;
  readonly spend_score: number;
  readonly leads_score: number;
  readonly sla_score: number;
  readonly alert_count: number;
  readonly last_updated: string;
  /**
   * Per-record sample marker, distinct from the envelope disclosure on purpose.
   *
   * A health badge routinely gets lifted out of its list into a card, a table
   * cell or a detail page and separated from the notice that qualified it. This
   * travels with the number itself so the marker cannot be lost in transit.
   */
  readonly is_sample: boolean;
}

export interface HealthMetrics {
  readonly roas: number;
  readonly spend: number;
  readonly leads: number;
  readonly sla: number;
}

export interface ClientData {
  readonly id: string;
  readonly name: string;
  readonly ghl_location_id: string;
  readonly csm_assigned: string;
  readonly health: ClientHealth;
  readonly last_activity?: string;
  readonly alert_count: number;
  readonly metrics?: HealthMetrics;
  readonly metrics_are_sample: boolean;
  readonly escalation: {
    readonly bucket: EscalationBucket;
    readonly reason: string | null;
    /** Days since the CSM last entered this tenant, or null if never. */
    readonly daysSinceLastCheckIn: number | null;
  };
}

export interface ClientAlert {
  readonly id: string;
  readonly type: 'critical' | 'warning' | 'info';
  readonly title: string;
  readonly message: string;
  readonly created_at: string;
  readonly resolved_at?: string;
}

/** Whose book to read. `mine` is keyed on the session and cannot be pointed at anyone. */
export type ClientBookScope = 'mine' | 'team' | 'department' | 'csm';

export type ClientStatusFilter = 'all' | ClientStatus;

export type ClientSortKey = 'name' | 'health' | 'roas' | 'spend';

export type SortOrder = 'asc' | 'desc';

/**
 * Query for `GET /api/clients`.
 *
 * Search, filter and sort run server-side. That is not a control — omitting
 * every field returns the same set — it just narrows what crosses the wire, and
 * it keeps one implementation of the ordering rules instead of two that drift.
 */
export interface ClientBookQuery {
  readonly scope?: ClientBookScope;
  /** Only meaningful with `scope: 'csm'`; the API rejects it otherwise. */
  readonly csmEmail?: string;
  readonly search?: string;
  readonly status?: ClientStatusFilter;
  readonly sortBy?: ClientSortKey;
  readonly sortOrder?: SortOrder;
}

export interface ClientBookResponse {
  readonly scope: ClientBookScope;
  /** Whose book this is, echoed back so a coverage view can label itself as one. */
  readonly csmEmail: string | null;
  readonly clients: readonly ClientData[];
  readonly total: number;
  readonly sampleData: SampleDataDisclosure;
}

export interface ClientDetailResponse {
  readonly client: ClientData;
  readonly sampleData: SampleDataDisclosure;
}

export interface ClientAlertsResponse {
  readonly clientId: string;
  readonly alerts: readonly ClientAlert[];
}

export interface MetaCampaign {
  readonly id: string;
  readonly name: string;
  readonly status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  readonly spend_24h: number;
  readonly impressions_24h: number;
  readonly clicks_24h: number;
  readonly leads_24h: number;
  /**
   * Cost per conversion in USD, NOT return on ad spend.
   *
   * The field was called `roas_24h` and computed `spend / conversions`, the
   * inverse of ROAS. Every reading built on it ran backwards: for ROAS higher
   * is better, for cost per conversion lower is. The name is carried across
   * unchanged so the mistake cannot be re-made on this side of the wire.
   */
  readonly costPerConversion24h?: number;
  readonly start_date?: string;
  readonly end_date?: string;
  readonly created_time: string;
}

export type CampaignWithCreativeCount = MetaCampaign & { readonly creative_count: number };

export interface ClientCampaignsResponse {
  readonly clientId: string;
  readonly metaAdAccountId: string | null;
  readonly campaigns: readonly CampaignWithCreativeCount[];
  /**
   * False when creative counts were not requested. Then every `creative_count`
   * is 0 as a placeholder, not as a count — do not render it as one.
   */
  readonly creativeCountsIncluded: boolean;
}

export interface CampaignRef {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly status: string;
}

export interface CreativeForDisplay {
  readonly id: string;
  readonly title: string;
  readonly platform: 'facebook' | 'instagram' | 'google' | 'tiktok' | 'meta' | 'other';
  readonly format: 'image' | 'video' | 'carousel' | 'text' | 'document';
  readonly status: 'draft' | 'pending-approval' | 'approved' | 'rejected';
  readonly thumbnail?: string;
  readonly description?: string;
  readonly submittedAt: string;
  readonly fileId?: string;
  readonly webViewLink?: string;
}

export type CreativeWithCampaigns = CreativeForDisplay & {
  readonly campaigns_using: readonly CampaignRef[];
};

export interface ClientCreativesResponse {
  readonly clientId: string;
  readonly locationId: string | null;
  readonly creatives: readonly CreativeWithCampaigns[];
  /**
   * False when the campaign-link lookup failed. Every `campaigns_using` is then
   * empty because it is unknown, not because the creative is unused. The screen
   * has to say which, or an unread state renders as a fact.
   */
  readonly campaignLinksIncluded: boolean;
}

export type Phase3Status =
  | 'pending'
  | 'in_progress'
  | 'meta_access_requested'
  | 'setup_guide_sent'
  | 'complete'
  | 'error';

export interface Phase3Progress {
  readonly locationId: string;
  readonly status: Phase3Status;
  readonly hasMetaAccount?: boolean;
  readonly lastEvent?: string;
  readonly lastEventTime?: string;
  readonly errorMessage?: string;
}

export interface ClientPhase3Response {
  readonly clientId: string;
  readonly locationId: string | null;
  /** Null means Phase 3 has not started, or the client has no GHL location. */
  readonly phase3: Phase3Progress | null;
}

/** Per-CSM rollup — the CSD widget's row. */
export interface CsmBookSummary {
  readonly csmEmail: string;
  readonly clientCount: number;
  readonly excellent: number;
  readonly healthy: number;
  readonly atRisk: number;
  readonly critical: number;
  readonly alert: number;
  readonly avgHealthScore: number;
  readonly ascensionReadyCount: number;
  readonly escalationAtRiskCount: number;
}

export interface DepartmentSummary {
  readonly totalClients: number;
  readonly csmCount: number;
  readonly avgHealthScore: number;
  /** at-risk + critical + alert. */
  readonly needsAttentionCount: number;
  readonly ascensionReadyCount: number;
  readonly escalationAtRiskCount: number;
  /** Worst average score first. */
  readonly booksByRisk: readonly CsmBookSummary[];
}

export interface ClientListWidgetResponse {
  readonly clients: readonly ClientData[];
  readonly sampleData: SampleDataDisclosure;
}

export interface TeamHealthRollupResponse {
  readonly books: readonly CsmBookSummary[];
  readonly sampleData: SampleDataDisclosure;
}

export interface DepartmentOverviewResponse {
  readonly summary: DepartmentSummary;
  readonly sampleData: SampleDataDisclosure;
}
