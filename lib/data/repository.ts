import "server-only";

import type { BatchWriter, CollectionRef, DocRef, Query, StoredDoc, Tx } from "./types";

import type { Group } from "@/lib/auth/groups";
import type { CsmRecord } from "@/lib/dashboard/csm-directory";
import type { ClientData, ClientAlert } from "@/lib/dashboard/csm-clients";
import type { BugReport } from "@/lib/bug-reports";
import type { DeadLetterEntry } from "@/lib/webhooks/types";
import type { Tenant } from "@/lib/ghl/tenants";
import type {
  StoredAgencyToken,
  StoredLocationToken,
  AppointmentOutcome,
  FollowUpConfig,
} from "@/lib/ghl/store";
import type { AuditEvent } from "@/lib/audit/store";
import type { ConversionLogEntry } from "@/lib/meta/conversions";
import type { OnboardingCompletion } from "@/lib/onboarding/store";
import type { CampaignLaunchState } from "@/lib/onboarding/campaign-launch-store";

/*
 * Domain types are imported type-only, so the erased build has no edge from
 * lib/data back into the feature modules and there is no cycle at runtime.
 */

/** Stored shapes that no feature module exports today. */

export type AuthCode = {
  readonly codeHash: string;
  /** Epoch millis. Firestore stores a Timestamp; the seam normalises on read. */
  readonly expiresAt: number;
  /** Epoch millis, same normalisation. */
  readonly issuedAt?: number;
  readonly attempts: number;
};

export type AuthCodeCooldown = {
  readonly lastIssuedAt: number;
};

export type ProcessedEvent = {
  readonly source: string;
  readonly eventId: string;
  readonly processedAt: number;
};

export type MetaFetchLog = {
  readonly fetchedAt: number;
};

export type MetaCreative = Record<string, unknown>;

export type ManualPageFields = Record<string, unknown>;

export type ManualPageVersion = {
  readonly pageId: string;
  readonly page: ManualPageFields;
  readonly authorUid: string;
  readonly authorEmail: string;
  readonly createdAt: number;
};

export type StoredBugReport = Omit<BugReport, "id">;

/** The doc id is the group id, so it is not a stored field. */
export type StoredGroup = Omit<Group, "id">;

/**
 * What `locations/{id}` actually holds, which is more than `Tenant` declares.
 *
 * `functions/src/firestore.ts#saveTenantResources` writes five fields the
 * `Tenant` type does not model, and the app reads two of them:
 * `lib/dashboard/location-config.ts` for Slack and Drive,
 * `lib/dashboard/data-fetchers.ts:177` gating creative loading on
 * `driveFolderId`.
 *
 * Surfaced by typing the collection at the seam. Against an untyped snapshot
 * `data?.slackChannelId` compiled happily and nothing recorded that the
 * provisioning writer and the reader had a contract `Tenant` was not party to.
 *
 * Declared here rather than by widening `Tenant`, because `Tenant` is the shape
 * `lib/ghl/tenants.ts` reads and writes deliberately. This is the stored
 * superset, and 14.4 has to reconcile the two when `locations` becomes a table:
 * the Postgres `tenants` table in `003` models neither.
 */
/**
 * `locations/{id}/auditLog` holds TWO shapes, and the module's own header says
 * so: general append-only `AuditEvent` records, and Story 3.5 impersonation
 * sessions that are created on entry and updated in place on exit.
 *
 * Typed as the superset rather than a union because reads are mixed:
 * `getAuditEvents` returns both kinds sorted together, deliberately, so an
 * impersonation session sorts alongside ordinary events. The impersonation
 * fields are optional here because they are absent on every other record.
 *
 * Nothing in that module deletes. Immutability is the collection's semantics
 * plus the absence of a delete call, which is worth knowing before 14.6 moves
 * it: a Postgres table grants DELETE unless someone decides otherwise.
 */
export type StoredAuditRecord = AuditEvent & {
  readonly entryTimestamp?: number;
  readonly exitTimestamp?: number | null;
};

export type StoredLocation = Tenant & {
  readonly slackChannelId?: string;
  readonly driveFolderId?: string;
  readonly metaSetupStatus?: string;
  readonly metaAccessRequestedAt?: string;
  readonly metaSetupGuidesentAt?: string;
};

export type AgencyRoot = {
  readonly primaryCompanyId?: string;
};

/**
 * The app's one data seam (story 14.1).
 *
 * Accessors that take a parameter are parent-scoped: the path really is a
 * subcollection, and the parent key becomes a foreign key when 14.2 lands
 * Postgres. Passing it as a query field instead would hide that.
 *
 * The interface wraps the operations the call sites actually perform. It does
 * not offer a uniform CRUD set on every path — several are write-only or
 * read-only today, and unused methods are surface area 14.10 would have to
 * delete.
 */
export interface Repository {
  // --- Top-level ---

  readonly authCodes: CollectionRef<AuthCode>;
  readonly authCodeCooldowns: CollectionRef<AuthCodeCooldown>;
  readonly groups: CollectionRef<StoredGroup>;
  readonly csm: CollectionRef<CsmRecord>;
  readonly clients: CollectionRef<ClientData>;
  /** Stored shape: the doc id is the id, so it is not a field. */
  readonly bugReports: CollectionRef<StoredBugReport>;
  readonly manualPages: CollectionRef<ManualPageFields>;
  readonly webhookDeadLetter: CollectionRef<DeadLetterEntry>;
  readonly webhookEventsProcessed: CollectionRef<ProcessedEvent>;
  /** `locations` is the tenant registry. `lib/ghl/tenants.ts` names it "tenants"; the collection is `locations`. */
  readonly locations: CollectionRef<StoredLocation>;
  readonly ghlAgencyRoot: DocRef<AgencyRoot>;
  readonly ghlCompanyTokens: CollectionRef<StoredAgencyToken>;
  readonly ghlLocationTokens: CollectionRef<StoredLocationToken>;

  // --- Parent-scoped ---

  clientAlerts(clientId: string): CollectionRef<ClientAlert>;
  clientMetaCreatives(clientId: string): CollectionRef<MetaCreative>;
  manualPageVersions(pageId: string): CollectionRef<ManualPageVersion>;
  auditLog(locationId: string): CollectionRef<StoredAuditRecord>;
  appointmentOutcomes(locationId: string): CollectionRef<AppointmentOutcome>;
  followUpConfig(locationId: string): DocRef<FollowUpConfig>;
  metaConversionLog(locationId: string): CollectionRef<ConversionLogEntry>;
  metaFetchLog(locationId: string): DocRef<MetaFetchLog>;
  onboardingChecklists(locationId: string): CollectionRef<OnboardingCompletion>;
  campaignLaunches(locationId: string): CollectionRef<CampaignLaunchState>;

  // --- Cross-cutting operations ---

  /**
   * Read-modify-write under contention. Two sites: consuming an OTP
   * (`lib/auth/otp.ts`) and amending an audit entry (`lib/audit/store.ts`).
   * Both are correctness-critical, not performance tuning — the OTP attempt cap
   * bounds parallel guesses only because of this.
   */
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;

  /** All-or-nothing writes. One site: `lib/knowledge-base/db.ts`. */
  batch(): BatchWriter;

  /**
   * Scans one subcollection name across every parent.
   *
   * One site: the Meta conversion retry job scans `metaConversionLog` for
   * failures without knowing which locations have any. There is no per-parent
   * form of this query. In Postgres it is the unqualified table scan.
   */
  collectionGroup<T>(name: string, query?: Query<T>): Promise<StoredDoc<T>[]>;
}
