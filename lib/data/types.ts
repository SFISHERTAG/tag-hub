import "server-only";

import type { Sentinel } from "./sentinels";

/**
 * Store-neutral primitives for the repository seam (story 14.1).
 *
 * Nothing here names Firestore. These types are the contract 14.2 onward
 * implements a second time over Postgres, so any concept that does not survive
 * the move — snapshots, `FieldValue` sentinels, `DocumentReference` — stays
 * behind the seam in `firestore-repository.ts`.
 */

export type Comparison = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";

export type Where<T> = {
  readonly field: Extract<keyof T, string>;
  readonly op: Comparison;
  readonly value: unknown;
};

export type Order<T> = {
  readonly field: Extract<keyof T, string>;
  readonly direction?: "asc" | "desc";
};

/**
 * `select` is a projection, not a convenience. `lib/ghl/tenants.ts` reads one
 * field across every location; without it that key scan becomes a full document
 * read of the whole tenant registry.
 */
export type Query<T> = {
  readonly where?: readonly Where<T>[];
  readonly orderBy?: Order<T>;
  readonly limit?: number;
  readonly select?: readonly Extract<keyof T, string>[];
};

/**
 * A read result. Carries `path` because `lib/meta/retry.ts` recovers the parent
 * `locationId` from it after a collection-group scan, and `ref` because the same
 * job writes the document back.
 */
export type StoredDoc<T> = {
  readonly id: string;
  readonly path: string;
  readonly data: T;
  readonly ref: DocRef<T>;
};

/**
 * Opaque transaction handle. Callers pass it back into repository methods; only
 * the implementation knows what is inside.
 */
export type Tx = {
  readonly __brand: "RepositoryTransaction";
};

/**
 * What a caller may write: any field may instead be a store-computed sentinel.
 *
 * Without this, `createdAt: serverTimestamp()` against a `createdAt: number`
 * field forces a double cast at every write site, and a cast is exactly the
 * thing that would let a genuinely wrong value through unnoticed.
 */
export type Writable<T> = { [K in keyof T]: WritableValue<T[K]> | Sentinel };

/**
 * Recursive, because `mapSentinels` is. The one live `deleteField` in the repo
 * is nested — `{ completedTasks: { [taskId]: deleteField() } }` in
 * `lib/onboarding/store.ts` — so a top-level-only `Writable` was narrower than
 * the runtime it describes and rejected a write the implementation handles
 * correctly. Arrays are passed through rather than mapped: no call site writes
 * a sentinel into an array position, and mapping them would make every array
 * element optionally a sentinel for no reason.
 */
type WritableValue<V> = V extends readonly unknown[]
  ? V
  : V extends Record<string, unknown>
    ? Writable<V>
    : V;

export interface DocRef<T> {
  readonly path: string;
  readonly id: string;
  get(tx?: Tx): Promise<T | null>;
  set(data: Writable<T>, options?: { readonly merge?: boolean }, tx?: Tx): Promise<void>;
  /**
   * Create-if-absent. Resolves `true` when this caller won the create and
   * `false` when the document already existed — it does not throw on the
   * collision, because the collision is the answer.
   *
   * This is the exactly-once webhook claim in `lib/webhooks/idempotency.ts`.
   * The Firestore implementation reads the gRPC ALREADY_EXISTS code; the
   * Postgres one will read a unique-violation. Neither leaks past the seam.
   */
  create(data: Writable<T>): Promise<boolean>;
  update(data: Partial<Writable<T>>, tx?: Tx): Promise<void>;
  delete(tx?: Tx): Promise<void>;
}

export interface CollectionRef<T> {
  readonly path: string;
  doc(id: string): DocRef<T>;
  /** Allocates an id without writing. `lib/knowledge-base/db.ts` needs one before its batch. */
  newId(): string;
  add(data: Writable<T>): Promise<string>;
  list(query?: Query<T>): Promise<StoredDoc<T>[]>;
  /** One round trip for many ids. Without it `lib/ghl/store.ts` degrades to N reads. */
  getAll(ids: readonly string[]): Promise<StoredDoc<T>[]>;
  /**
   * Document ids without reading their contents.
   *
   * Not `list()` with a projection. Firestore's `listDocuments()` also returns
   * documents that exist only as a parent of a subcollection and carry no
   * fields of their own, which a query would not surface at all. Two sites
   * enumerate stored credentials this way, and reading every token document to
   * produce a list of ids would be both slower and a needless handling of
   * secrets.
   */
  listIds(): Promise<string[]>;
}

/**
 * Write-only, all-or-nothing. `lib/knowledge-base/db.ts` writes a version
 * snapshot and the page update together; a partial write loses revert history.
 */
export interface BatchWriter {
  set<T>(ref: DocRef<T>, data: Writable<T>, options?: { readonly merge?: boolean }): void;
  update<T>(ref: DocRef<T>, data: Partial<Writable<T>>): void;
  delete<T>(ref: DocRef<T>): void;
  commit(): Promise<void>;
}
