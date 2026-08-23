# The repository seam

One module reaches Firestore. Everything else asks the repository.

Story 14.1. This document is the contract stories 14.2 through 14.10 build on,
so it describes what the interface guarantees and, more importantly, what it
deliberately does not.

---

## The shape

```ts
import { repository } from "@/lib/data";

const report = await repository().bugReports.list({
  where: [{ field: "userId", op: "==", value: uid }],
  orderBy: { field: "createdAt", direction: "desc" },
  limit: 20,
});
```

Two kinds of accessor:

**Top-level** paths read as plain properties.

```ts
repository().groups.doc(id).get()
repository().clients.doc(clientId).set(record, { merge: true })
```

**Parent-scoped** paths take the parent key as a parameter, because they are
subcollections and the parent really is part of the path.

```ts
repository().auditLog(locationId).add(event)
repository().manualPageVersions(pageId).create(snapshot)
repository().appointmentOutcomes(locationId).getAll(appointmentIds)
```

Twelve of the twenty-three document paths are parent-scoped. Passing the parent
as a query field instead would hide the relationship that becomes a foreign key
in Postgres, which is exactly the information 14.2 onward needs.

---

## What the interface carries beyond get and set

Every one of these exists because a call site needs it. None is speculative,
and a Postgres implementation has to provide all of them.

| Operation | Sites | Why it cannot be simplified away |
| --- | --- | --- |
| `transaction()` | 2 | `lib/auth/otp.ts` consumes a one-time code; `lib/audit/store.ts` amends an audit entry. Both are read-modify-write under contention. The OTP attempt cap bounds *parallel* guesses only because of this — without it the cap bounds sequential guesses, which against a 6-digit code is no cap at all. |
| `batch()` | 1 | `lib/knowledge-base/db.ts` writes a version snapshot and the new page content together. A partial write loses the ability to revert. |
| `collectionGroup()` | 1 | The Meta retry job scans `metaConversionLog` across every location for failures. There is no per-parent form: the job does not know which locations have failures. |
| `getAll()` | 1 | Multi-document read by id list. Without it `lib/ghl/store.ts` degrades to N round trips. |
| `listIds()` | 2 | Document ids without reading contents. Not `list()` with a projection: it also returns documents that exist only as a subcollection parent. Both sites enumerate stored credentials, so reading every token to produce a list of ids would be slower and a needless handling of secrets. |
| `select` in a query | 1 | `lib/ghl/tenants.ts` reads one field across every location. Dropping it turns a key scan into a full read of the tenant registry. |
| `create()` | 2 | Create-if-absent. Returns `false` on collision rather than throwing. |

### `create()` deserves its own paragraph

Both sites depend on the write **failing** when the document exists.

- `functions/src/lib/webhooks/idempotency.ts` — the exactly-once webhook claim.
- `lib/onboarding/campaign-launch-store.ts` — reserves a campaign launch key.

Migrating either to `set()` converts exactly-once into last-write-wins. The
first double-processes a webhook. The second lets a concurrent caller overwrite
a launch already in progress, and its caller does not wrap the call — the next
statement proceeds to create a campaign at Meta. That is a duplicate paid
campaign with no error anywhere.

The repository reports the collision as `false` because that is implementable on
both stores (Firestore's `ALREADY_EXISTS`, Postgres's unique violation).
`reserveCampaignLaunch` converts it back into a throw deliberately, and says so
in a comment. **If you add a `create()` caller, decide explicitly what a `false`
means to you.**

---

## Sentinels

Values the store computes, not the caller.

```ts
import { serverTimestamp, deleteField, arrayUnion } from "@/lib/data";

await repository().bugReports.add({ ...input, createdAt: serverTimestamp() });
await ref.set({ completedTasks: { [taskId]: deleteField() } }, { merge: true });
```

They are named here rather than passed through as `FieldValue` because each has
a real but different Postgres equivalent: `now()`, removing a JSON key, an array
append. `serverTimestamp` matters most — the value is assigned by the store, so
replacing it with `Date.now()` during migration is a silent behaviour change
visible only as clock skew between writers.

Sentinels may be nested. The one live `deleteField` in this repo is
(`{ completedTasks: { [taskId]: deleteField() } }`), and both the type and the
runtime handle nesting.

---

## Timestamps

The repository normalises to **epoch milliseconds** at the boundary. Call sites
neither construct nor unwrap a `Timestamp`.

Per-path codecs do the conversion (`lib/data/codec.ts`), because the underlying
documents are not consistent. Three conventions are live in the code today:

- `Timestamp.now()` / `Timestamp.fromMillis()` — `authCodes`, `authCodeCooldowns`
- `FieldValue.serverTimestamp()` — `bugReports.createdAt`
- `new Date()` — `locations.createdAt`, written by `functions/src/firestore.ts`

**Story 14.4 has to pick one rather than inherit three.** The codec layer hides
the inconsistency from call sites; it does not resolve it.

---

## Types describe what is STORED, not what a reader wants

This is the part most likely to bite.

Five collections were found to have declared types narrower than their contents,
and every one was invisible until the collection was typed at the seam:

| Path | What was missing |
| --- | --- |
| `locations/{id}` | `Tenant` declares neither `slackChannelId`, `driveFolderId`, `googleDocId`, `ownerEmail`, `createdAt` nor `provisioned`. `functions/src/firestore.ts` writes all of them; the app reads two. |
| `locations/{id}/auditLog` | Holds **two** document shapes: general events, and impersonation sessions updated in place on exit. |
| `clients/{id}` | Was typed as `ClientData`, which is the **view model** — `health`, `escalation` and `alert_count` are computed per request and no document stores them. |
| `ghl/agency` | Is both a pointer and, on older deployments, a full token. `loadAgencyToken` reads those fields to migrate them down on first read. |
| `manual_pages`, `groups`, `bugReports` | Doc id is the entity id and is not a stored field, hence the `Stored*` variants. |

The rule that finds these: **read the writers, not the readers.** A reader's type
describes what that reader wanted. Only the writers say what is in the document.
`functions/src/firestore.ts` is a writer with no app-side reader at all, which is
why its fields went unmodelled for so long.

---

## Testing

Use the in-memory fake. Do not hand-roll a Firestore stub.

```ts
import { FakeStore, fakeRepository } from "@/lib/data/fake-repository";

const store = new FakeStore();
const { repository } = fakeRepository(store);

vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return { ...actual, repository: () => repository };
});
```

`FakeStore` keys documents by full path, so assertions can read
`store.read("locations/loc-1/auditLog/abc")` directly.

Four hand-rolled Firestore stubs were deleted during this migration. Each
implemented exactly the methods its own caller used, so each encoded that usage
as the contract and broke the moment the call site changed shape. Two of them
were also the reason a bug could not be seen.

The fake is not a convenience. It is the reason `verifyCode` — the OTP attempt
cap — has tests at all. It previously had none anywhere in the repo and could not
have: it runs inside a transaction, so exercising it meant reaching real
Firestore.

---

## Enforcement

`eslint.config.mjs` restricts `@/lib/firestore` and `@google-cloud/firestore`
across `lib/**` and `app/**`, exempting `lib/data/**`. Verified in both
directions: a planted violation is caught, and the implementation is not.

A re-export cannot escape it — re-exporting requires importing, and the import is
what the rule sees. That matters because the single bypass that existed was a
re-export: `lib/ghl/store.ts` exported the client handle, so any of its fifteen
importers could have taken it without importing `lib/firestore` at all.

---

## What this story deliberately did NOT do

- **No dual-write.** The implementation is 100% Firestore. Dual-write is 14.3–14.9.
- **No behaviour changes.** Where the old code was wrong, the wrongness was
  preserved and recorded rather than fixed in passing — except where migrating
  faithfully was impossible, which is noted in the code at each site.
- **No `functions/`.** Separate workspace, `rootDir: ./src`, no path mapping to
  `lib/`, and `@google-cloud/firestore` `^7` against root's `^8`. It folds into
  `app/api` under story 14.A, which also blocks 14.10: the SDK cannot be dropped
  while `functions/` has its own client.
- **No speculative methods.** The interface wraps operations that exist. Adding
  `delete()` to a path nothing deletes from is surface area 14.10 would have to
  remove unused.

---

## For 14.2 onward

Implement `Repository` a second time. `lib/data/fake-repository.ts` is the proof
it is implementable by something that is not Firestore, and it is deliberately
small enough to read in one sitting.

The seam's boundary is `lib/data/index.ts`. If a call site needs something the
interface does not offer, **add it to the interface**. Reaching past it is the
one thing this story exists to prevent, and the lint rule will stop you.
