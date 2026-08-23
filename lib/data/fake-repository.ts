import type {
  BatchWriter,
  CollectionRef,
  Comparison,
  DocRef,
  Query,
  StoredDoc,
  Tx,
  Writable,
} from "./types";
import type {
  AgencyRoot,
  AuthCode,
  AuthCodeCooldown,
  ManualPageFields,
  ManualPageVersion,
  MetaCreative,
  MetaFetchLog,
  ProcessedEvent,
  Repository,
  StoredBugReport,
  StoredLocation,
} from "./repository";
import { mapSentinels, sentinelKind, sentinelValues, type Sentinel } from "./sentinels";
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
 * In-memory Repository for tests (story 14.1).
 *
 * Deliberately not "server-only": tests import it directly. It stores plain
 * rows keyed by full path, so a collection-group scan is a path suffix match,
 * the same way it is a table scan in Postgres.
 *
 * This existing at all is the seam's proof: the interface is implementable by
 * something that is not Firestore, which is exactly what 14.2 has to do.
 */

type Row = Record<string, unknown>;

/** Marks a key the caller asked to delete. Pruned on write, never stored. */
const DELETED = Symbol("deleted");

/**
 * Tests need a serverTimestamp that is deterministic, so this counts instead of
 * reading the clock. What matters for the seam is that the STORE assigns it and
 * the caller does not, which is preserved either way.
 */
let clock = 0;

function resolveSentinel(sentinel: Sentinel): unknown {
  switch (sentinelKind(sentinel)) {
    case "serverTimestamp":
      clock += 1;
      return clock;
    case "deleteField":
      return DELETED;
    case "arrayUnion":
      return sentinelValues(sentinel);
  }
}

/** Drops DELETED keys at every level, so a deleted field is absent, not undefined. */
function prune(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === DELETED) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = prune(value as Row);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function resolved(row: Row): Row {
  return mapSentinels(row, resolveSentinel);
}

function matches(row: Row, field: string, op: Comparison, value: unknown): boolean {
  const actual = row[field];
  switch (op) {
    case "==":
      return actual === value;
    case "!=":
      return actual !== value;
    case "<":
      return (actual as number) < (value as number);
    case "<=":
      return (actual as number) <= (value as number);
    case ">":
      return (actual as number) > (value as number);
    case ">=":
      return (actual as number) >= (value as number);
    case "in":
      return Array.isArray(value) && value.includes(actual);
    case "array-contains":
      return Array.isArray(actual) && actual.includes(value);
  }
}

export class FakeStore {
  private readonly rows = new Map<string, Row>();
  private sequence = 0;

  newId(): string {
    this.sequence += 1;
    return `fake-${this.sequence}`;
  }

  read(path: string): Row | null {
    const row = this.rows.get(path);
    return row ? { ...row } : null;
  }

  write(path: string, row: Row): void {
    this.rows.set(path, prune(resolved(row)));
  }

  /**
   * Merge is shallow at the top level but must still honour a nested delete,
   * because the one live deleteField in the repo is nested:
   * `{ completedTasks: { [taskId]: deleteField() } }`.
   */
  merge(path: string, row: Row): void {
    const current = this.rows.get(path) ?? {};
    const incoming = resolved(row);
    const merged: Row = { ...current };
    for (const [key, value] of Object.entries(incoming)) {
      const existing = merged[key];
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        existing !== null &&
        typeof existing === "object" &&
        !Array.isArray(existing)
      ) {
        merged[key] = { ...(existing as Row), ...(value as Row) };
      } else {
        merged[key] = value;
      }
    }
    this.rows.set(path, prune(merged));
  }

  remove(path: string): void {
    this.rows.delete(path);
  }

  has(path: string): boolean {
    return this.rows.has(path);
  }

  /** Direct children of `path` — one segment deeper, not the whole subtree. */
  childrenOf(path: string): { path: string; row: Row }[] {
    const prefix = `${path}/`;
    const out: { path: string; row: Row }[] = [];
    for (const [key, row] of this.rows) {
      if (!key.startsWith(prefix)) continue;
      if (key.slice(prefix.length).includes("/")) continue;
      out.push({ path: key, row: { ...row } });
    }
    return out;
  }

  /** Every document whose parent collection is named `name`, at any depth. */
  collectionGroup(name: string): { path: string; row: Row }[] {
    const out: { path: string; row: Row }[] = [];
    for (const [key, row] of this.rows) {
      const segments = key.split("/");
      if (segments.length >= 2 && segments[segments.length - 2] === name) {
        out.push({ path: key, row: { ...row } });
      }
    }
    return out;
  }

  /** Test helper: everything currently stored, for assertions. */
  snapshot(): Record<string, Row> {
    return Object.fromEntries([...this.rows].map(([k, v]) => [k, { ...v }]));
  }
}

function applyQuery<T>(
  entries: { path: string; row: Row }[],
  query: Query<T> | undefined,
): { path: string; row: Row }[] {
  let out = entries;
  for (const clause of query?.where ?? []) {
    out = out.filter((entry) => matches(entry.row, clause.field, clause.op, clause.value));
  }
  if (query?.orderBy) {
    const { field, direction } = query.orderBy;
    const sign = direction === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const left = a.row[field] as number | string;
      const right = b.row[field] as number | string;
      if (left === right) return 0;
      return left < right ? -sign : sign;
    });
  }
  if (query?.select) {
    const fields = query.select;
    out = out.map((entry) => ({
      path: entry.path,
      row: Object.fromEntries(fields.map((f) => [f, entry.row[f]])),
    }));
  }
  if (query?.limit !== undefined) out = out.slice(0, query.limit);
  return out;
}

class FakeDocRef<T> implements DocRef<T> {
  constructor(
    readonly path: string,
    private readonly store: FakeStore,
  ) {}

  get id(): string {
    return this.path.split("/").pop() ?? "";
  }

  async get(): Promise<T | null> {
    return this.store.read(this.path) as T | null;
  }

  async set(data: Writable<T>, options?: { readonly merge?: boolean }): Promise<void> {
    const row = data as unknown as Row;
    if (options?.merge) this.store.merge(this.path, row);
    else this.store.write(this.path, row);
  }

  async create(data: Writable<T>): Promise<boolean> {
    if (this.store.has(this.path)) return false;
    this.store.write(this.path, data as unknown as Row);
    return true;
  }

  async update(data: Partial<Writable<T>>): Promise<void> {
    this.store.merge(this.path, data as unknown as Row);
  }

  async delete(): Promise<void> {
    this.store.remove(this.path);
  }
}

class FakeCollectionRef<T> implements CollectionRef<T> {
  constructor(
    readonly path: string,
    private readonly store: FakeStore,
  ) {}

  doc(id: string): DocRef<T> {
    return new FakeDocRef<T>(`${this.path}/${id}`, this.store);
  }

  newId(): string {
    return this.store.newId();
  }

  async add(data: Writable<T>): Promise<string> {
    const id = this.store.newId();
    this.store.write(`${this.path}/${id}`, data as unknown as Row);
    return id;
  }

  async list(query?: Query<T>): Promise<StoredDoc<T>[]> {
    return applyQuery(this.store.childrenOf(this.path), query).map((entry) =>
      this.hydrate(entry.path, entry.row),
    );
  }

  async getAll(ids: readonly string[]): Promise<StoredDoc<T>[]> {
    const out: StoredDoc<T>[] = [];
    for (const id of ids) {
      const path = `${this.path}/${id}`;
      const row = this.store.read(path);
      if (row) out.push(this.hydrate(path, row));
    }
    return out;
  }

  private hydrate(path: string, row: Row): StoredDoc<T> {
    return {
      id: path.split("/").pop() ?? "",
      path,
      data: row as unknown as T,
      ref: new FakeDocRef<T>(path, this.store),
    };
  }
}

class FakeBatchWriter implements BatchWriter {
  private readonly queued: (() => void)[] = [];

  constructor(private readonly store: FakeStore) {}

  set<T>(ref: DocRef<T>, data: Writable<T>, options?: { readonly merge?: boolean }): void {
    this.queued.push(() => {
      const row = data as unknown as Row;
      if (options?.merge) this.store.merge(ref.path, row);
      else this.store.write(ref.path, row);
    });
  }

  update<T>(ref: DocRef<T>, data: Partial<Writable<T>>): void {
    this.queued.push(() => this.store.merge(ref.path, data as unknown as Row));
  }

  delete<T>(ref: DocRef<T>): void {
    this.queued.push(() => this.store.remove(ref.path));
  }

  async commit(): Promise<void> {
    for (const write of this.queued) write();
    this.queued.length = 0;
  }
}

export function fakeRepository(store: FakeStore = new FakeStore()): {
  repository: Repository;
  store: FakeStore;
} {
  const collection = <T,>(path: string): CollectionRef<T> =>
    new FakeCollectionRef<T>(path, store);
  const document = <T,>(path: string): DocRef<T> => new FakeDocRef<T>(path, store);

  const repository: Repository = {
    get authCodes() {
      return collection<AuthCode>("authCodes");
    },
    get authCodeCooldowns() {
      return collection<AuthCodeCooldown>("authCodeCooldowns");
    },
    get groups() {
      return collection<Group>("groups");
    },
    get csm() {
      return collection<CsmRecord>("csm");
    },
    get clients() {
      return collection<ClientData>("clients");
    },
    get bugReports() {
      return collection<StoredBugReport>("bugReports");
    },
    get manualPages() {
      return collection<ManualPageFields>("manual_pages");
    },
    get webhookDeadLetter() {
      return collection<DeadLetterEntry>("webhookDeadLetter");
    },
    get webhookEventsProcessed() {
      return collection<ProcessedEvent>("webhookEventsProcessed");
    },
    get locations() {
      return collection<StoredLocation>("locations");
    },
    get ghlAgencyRoot() {
      return document<AgencyRoot>("ghl/agency");
    },
    get ghlCompanyTokens() {
      return collection<StoredAgencyToken>("ghl/agency/companies");
    },
    get ghlLocationTokens() {
      return collection<StoredLocationToken>("ghl/agency/locations");
    },

    clientAlerts: (clientId) => collection<ClientAlert>(`clients/${clientId}/alerts`),
    clientMetaCreatives: (clientId) =>
      collection<MetaCreative>(`clients/${clientId}/meta_creatives`),
    manualPageVersions: (pageId) =>
      collection<ManualPageVersion>(`manual_pages/${pageId}/versions`),
    auditLog: (locationId) => collection<AuditEvent>(`locations/${locationId}/auditLog`),
    appointmentOutcomes: (locationId) =>
      collection<AppointmentOutcome>(`locations/${locationId}/appointmentOutcomes`),
    followUpConfig: (locationId) =>
      document<FollowUpConfig>(`locations/${locationId}/settings/followUp`),
    metaConversionLog: (locationId) =>
      collection<ConversionLogEntry>(`locations/${locationId}/metaConversionLog`),
    metaFetchLog: (locationId) =>
      document<MetaFetchLog>(`locations/${locationId}/metaFetchLog/latest`),
    onboardingChecklists: (locationId) =>
      collection<OnboardingCompletion>(`locations/${locationId}/onboardingChecklists`),
    campaignLaunches: (locationId) =>
      collection<CampaignLaunchState>(`locations/${locationId}/campaignLaunches`),

    // Writes apply immediately. The fake is single-threaded, so there is no
    // contention to isolate — tests that care about the OTP attempt race should
    // assert on the transaction body, not on rollback.
    transaction: <T,>(work: (tx: Tx) => Promise<T>): Promise<T> =>
      work({} as unknown as Tx),

    batch: () => new FakeBatchWriter(store),

    collectionGroup: async <T,>(name: string, query?: Query<T>): Promise<StoredDoc<T>[]> =>
      applyQuery(store.collectionGroup(name), query).map((entry) => ({
        id: entry.path.split("/").pop() ?? "",
        path: entry.path,
        data: entry.row as unknown as T,
        ref: new FakeDocRef<T>(entry.path, store),
      })),
  };

  return { repository, store };
}
