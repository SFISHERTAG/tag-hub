import "server-only";

import type {
  CollectionReference,
  DocumentReference,
  Query as FsQuery,
  Transaction,
  WriteBatch,
} from "@google-cloud/firestore";

import { FieldValue } from "@google-cloud/firestore";

import { firestore } from "@/lib/firestore";
import { mapSentinels, sentinelKind, sentinelValues, type Sentinel } from "./sentinels";
import type { Codec } from "./codec";
import { identityCodec, timestampCodec } from "./codec";
import type {
  BatchWriter,
  CollectionRef,
  DocRef,
  Query,
  StoredDoc,
  Tx,
  Writable,
} from "./types";
import type { CsmRecord } from "@/lib/dashboard/csm-directory";
import type { ClientAlert } from "@/lib/dashboard/csm-clients";
import type { DeadLetterEntry } from "@/lib/webhooks/types";
import type {
  StoredAgencyToken,
  StoredLocationToken,
  AppointmentOutcome,
  FollowUpConfig,
} from "@/lib/ghl/store";
import type { ConversionLogEntry } from "@/lib/meta/conversions";
import type { OnboardingCompletion } from "@/lib/onboarding/store";
import type { CampaignLaunchState } from "@/lib/onboarding/campaign-launch-store";
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
  StoredAuditRecord,
  StoredBugReport,
  StoredClient,
  StoredGroup,
  StoredLocation,
} from "./repository";

/*
 * The Firestore side of the seam (story 14.1).
 *
 * This is the only module in lib/** and app/** allowed to import
 * @/lib/firestore or the Firestore SDK. Everything Firestore-shaped —
 * snapshots, DocumentReference, Timestamp, gRPC status codes — is confined
 * here, so 14.2 can add a Postgres implementation of the same interface
 * without a single call site changing.
 */

/** Firestore's gRPC status code for ALREADY_EXISTS. */
const ALREADY_EXISTS = 6;

/** Sentinels are resolved on the way out, never stored as the branded object. */
function toFieldValue(sentinel: Sentinel): unknown {
  switch (sentinelKind(sentinel)) {
    case "serverTimestamp":
      return FieldValue.serverTimestamp();
    case "deleteField":
      return FieldValue.delete();
    case "arrayUnion":
      return FieldValue.arrayUnion(...sentinelValues(sentinel));
  }
}

function row<T>(codec: Codec<T>, data: Writable<T> | Partial<Writable<T>>): Record<string, unknown> {
  return mapSentinels(codec.toStore(data as T), toFieldValue);
}

type Native = { readonly tx: Transaction };

function nativeTx(tx: Tx | undefined): Transaction | null {
  return tx ? (tx as unknown as Native).tx : null;
}

class FsDocRef<T> implements DocRef<T> {
  constructor(
    private readonly ref: DocumentReference,
    private readonly codec: Codec<T>,
  ) {}

  get path(): string {
    return this.ref.path;
  }

  get id(): string {
    return this.ref.id;
  }

  async get(tx?: Tx): Promise<T | null> {
    const native = nativeTx(tx);
    const snapshot = native ? await native.get(this.ref) : await this.ref.get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    if (!data) return null;
    return this.codec.fromStore(data);
  }

  async set(data: Writable<T>, options?: { readonly merge?: boolean }, tx?: Tx): Promise<void> {
    const written = row(this.codec, data);
    const native = nativeTx(tx);
    if (native) {
      if (options?.merge) native.set(this.ref, written, { merge: true });
      else native.set(this.ref, written);
      return;
    }
    if (options?.merge) await this.ref.set(written, { merge: true });
    else await this.ref.set(written);
  }

  async create(data: Writable<T>): Promise<boolean> {
    try {
      await this.ref.create(row(this.codec, data));
      return true;
    } catch (error) {
      // The collision is the answer, not a failure: exactly one concurrent
      // caller wins the create and the rest learn someone else has the event.
      if (isAlreadyExists(error)) return false;
      throw error;
    }
  }

  async update(data: Partial<Writable<T>>, tx?: Tx): Promise<void> {
    const written = row(this.codec, data);
    const native = nativeTx(tx);
    if (native) {
      native.update(this.ref, written);
      return;
    }
    await this.ref.update(written);
  }

  async delete(tx?: Tx): Promise<void> {
    const native = nativeTx(tx);
    if (native) {
      native.delete(this.ref);
      return;
    }
    await this.ref.delete();
  }
}

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === ALREADY_EXISTS
  );
}

function applyQuery<T>(base: FsQuery, query: Query<T> | undefined): FsQuery {
  let q = base;
  for (const clause of query?.where ?? []) {
    q = q.where(clause.field, clause.op, clause.value);
  }
  if (query?.orderBy) {
    q = q.orderBy(query.orderBy.field, query.orderBy.direction ?? "asc");
  }
  if (query?.select) {
    q = q.select(...query.select);
  }
  if (query?.limit !== undefined) {
    q = q.limit(query.limit);
  }
  return q;
}

class FsCollectionRef<T> implements CollectionRef<T> {
  constructor(
    private readonly ref: CollectionReference,
    private readonly codec: Codec<T>,
  ) {}

  get path(): string {
    return this.ref.path;
  }

  doc(id: string): DocRef<T> {
    return new FsDocRef(this.ref.doc(id), this.codec);
  }

  newId(): string {
    return this.ref.doc().id;
  }

  async add(data: Writable<T>): Promise<string> {
    const created = await this.ref.add(row(this.codec, data));
    return created.id;
  }

  async list(query?: Query<T>): Promise<StoredDoc<T>[]> {
    const snapshot = await applyQuery(this.ref, query).get();
    return snapshot.docs.map((doc) => this.hydrate(doc.id, doc.ref, doc.data()));
  }

  async getAll(ids: readonly string[]): Promise<StoredDoc<T>[]> {
    if (ids.length === 0) return [];
    const refs = ids.map((id) => this.ref.doc(id));
    const snapshots = await firestore().getAll(...refs);
    return snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => this.hydrate(snapshot.id, snapshot.ref, snapshot.data() ?? {}));
  }

  private hydrate(id: string, ref: DocumentReference, row: Record<string, unknown>): StoredDoc<T> {
    return {
      id,
      path: ref.path,
      data: this.codec.fromStore(row),
      ref: new FsDocRef(ref, this.codec),
    };
  }
}

class FsBatchWriter implements BatchWriter {
  private readonly batch: WriteBatch;

  constructor() {
    this.batch = firestore().batch();
  }

  set<T>(ref: DocRef<T>, data: Writable<T>, options?: { readonly merge?: boolean }): void {
    const native = firestore().doc(ref.path);
    const written = mapSentinels(data as unknown as Record<string, unknown>, toFieldValue);
    if (options?.merge) this.batch.set(native, written, { merge: true });
    else this.batch.set(native, written);
  }

  update<T>(ref: DocRef<T>, data: Partial<Writable<T>>): void {
    this.batch.update(
      firestore().doc(ref.path),
      mapSentinels(data as unknown as Record<string, unknown>, toFieldValue),
    );
  }

  delete<T>(ref: DocRef<T>): void {
    this.batch.delete(firestore().doc(ref.path));
  }

  async commit(): Promise<void> {
    await this.batch.commit();
  }
}

function collection<T>(path: string, codec: Codec<T> = identityCodec<T>()): CollectionRef<T> {
  return new FsCollectionRef(firestore().collection(path), codec);
}

function document<T>(path: string, codec: Codec<T> = identityCodec<T>()): DocRef<T> {
  return new FsDocRef(firestore().doc(path), codec);
}

/**
 * `authCodes` and `authCodeCooldowns` are the two paths that store `Timestamp`.
 * Their codecs are the reason `Timestamp` does not appear above this line.
 */
const authCodeCodec = timestampCodec<AuthCode>(["expiresAt", "issuedAt"]);
const cooldownCodec = timestampCodec<AuthCodeCooldown>(["lastIssuedAt"]);
/** `createdAt` is written as a serverTimestamp sentinel and read back as a Timestamp. */
const bugReportCodec = timestampCodec<StoredBugReport>(["createdAt"]);

export function firestoreRepository(): Repository {
  return {
    get authCodes() {
      return collection<AuthCode>("authCodes", authCodeCodec);
    },
    get authCodeCooldowns() {
      return collection<AuthCodeCooldown>("authCodeCooldowns", cooldownCodec);
    },
    get groups() {
      return collection<StoredGroup>("groups");
    },
    get csm() {
      return collection<CsmRecord>("csm");
    },
    get clients() {
      return collection<StoredClient>("clients");
    },
    get bugReports() {
      return collection<StoredBugReport>("bugReports", bugReportCodec);
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
    auditLog: (locationId) => collection<StoredAuditRecord>(`locations/${locationId}/auditLog`),
    appointmentOutcomes: (locationId) =>
      collection<AppointmentOutcome>(`locations/${locationId}/appointmentOutcomes`),
    followUpConfig: (locationId) => document<FollowUpConfig>(`locations/${locationId}/settings/followUp`),
    metaConversionLog: (locationId) =>
      collection<ConversionLogEntry>(`locations/${locationId}/metaConversionLog`),
    metaFetchLog: (locationId) =>
      document<MetaFetchLog>(`locations/${locationId}/metaFetchLog/latest`),
    onboardingChecklists: (locationId) =>
      collection<OnboardingCompletion>(`locations/${locationId}/onboardingChecklists`),
    campaignLaunches: (locationId) => collection<CampaignLaunchState>(`locations/${locationId}/campaignLaunches`),

    transaction: <T,>(work: (tx: Tx) => Promise<T>): Promise<T> =>
      firestore().runTransaction((tx) => work({ tx } as unknown as Tx)),

    batch: () => new FsBatchWriter(),

    collectionGroup: async <T,>(name: string, query?: Query<T>): Promise<StoredDoc<T>[]> => {
      const snapshot = await applyQuery(firestore().collectionGroup(name), query).get();
      const codec = identityCodec<T>();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        path: doc.ref.path,
        data: codec.fromStore(doc.data()),
        ref: new FsDocRef<T>(doc.ref, codec),
      }));
    },
  };
}

let memo: Repository | null = null;

/**
 * The app's repository. Memoised so call sites can reach for it freely without
 * each one building its own, the same reason `lib/firestore.ts` memoises the
 * client it wraps.
 *
 * 14.2 replaces the body of this function and nothing else.
 */
export function repository(): Repository {
  if (!memo) memo = firestoreRepository();
  return memo;
}
