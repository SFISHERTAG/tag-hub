import type { Role } from "@/lib/auth/roles";
import {
  FIELD_CATALOG,
  type FieldDefinition,
  type FieldVisibility,
} from "./field-catalog.generated";

/**
 * Field visibility — *which columns*, the counterpart to scope.ts's *whose rows*.
 *
 * Story 7.4. The rule from docs/client-fields.md §2, kept verbatim because it is
 * the whole design: "Allowlist, not blocklist. A blocklist someone forgets to
 * update is how your management-fee margin lands on a client's screen. Enforce at
 * the query layer — a component that forgets a conditional is a bug; a query that
 * cannot return the column is not."
 *
 * So the permitted set is derived from the catalog, and `FieldAllowlist` is
 * branded exactly as `ScopeFilter` is: only `resolveFields` can mint one, and the
 * projection and column-list helpers require one. There is no overload taking a
 * bare role or a bare string array — those are the shapes a caller reaches for
 * when they are about to get this wrong.
 *
 * A field absent from a role's map is `never`. Unknown roles and unknown field ids
 * are denied. The default is always "no".
 */

declare const fieldBrand: unique symbol;

export type FieldAllowlist = {
  readonly role: Role;
  /** Every field this role may read — the union of `on` and `available`. */
  readonly permitted: ReadonlySet<string>;
  /** The subset shown unless the user turns it off. */
  readonly defaultOn: ReadonlySet<string>;
  readonly [fieldBrand]: "fields";
};

export function visibilityOf(field: FieldDefinition, role: Role): FieldVisibility {
  return field.visibility[role] ?? "never";
}

/**
 * The single point where the brand is applied.
 *
 * The cast goes through `unknown` because a `ReadonlySet` object literal does not
 * structurally overlap the branded type. Keeping it in one private function means
 * exactly one place in the codebase can do this, which is the point of the brand.
 */
function mint(
  role: Role,
  permitted: ReadonlySet<string>,
  defaultOn: ReadonlySet<string>,
): FieldAllowlist {
  return { role, permitted, defaultOn } as unknown as FieldAllowlist;
}

/** The only way to obtain a `FieldAllowlist`. */
export function resolveFields(role: Role): FieldAllowlist {
  const permitted = new Set<string>();
  const defaultOn = new Set<string>();

  for (const field of Object.values(FIELD_CATALOG)) {
    const visibility = visibilityOf(field, role);
    if (visibility === "never") continue;
    permitted.add(field.id);
    if (visibility === "on") defaultOn.add(field.id);
  }

  return mint(role, permitted, defaultOn);
}

export function canSee(allowlist: FieldAllowlist, fieldId: string): boolean {
  return allowlist.permitted.has(fieldId);
}

/**
 * The column list a query may select.
 *
 * Pass the fields a caller *wants*; get back only those it may have. Intersection,
 * never union — a requested field that is not permitted is dropped silently rather
 * than raising, because the alternative is a UI that reveals the existence of
 * `contract.mrr` by erroring on it.
 */
export function columnsFor(
  allowlist: FieldAllowlist,
  requested?: readonly string[],
): string[] {
  const wanted = requested ?? [...allowlist.defaultOn];
  return wanted.filter((id) => allowlist.permitted.has(id));
}

/**
 * Strips every key the role may not see.
 *
 * Belt to `columnsFor`'s braces: the column list keeps forbidden data out of the
 * query, and this keeps it out of the response if a fetcher ever returns more than
 * it was asked for — a joined table, a `SELECT *`, a Firestore document read whole.
 * Keys not in the catalog at all are dropped too, so a new field is invisible until
 * someone classifies it.
 */
export function project<T extends Record<string, unknown>>(
  allowlist: FieldAllowlist,
  record: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(record)) {
    if (allowlist.permitted.has(key)) out[key as keyof T] = record[key] as T[keyof T];
  }
  return out;
}

export function projectAll<T extends Record<string, unknown>>(
  allowlist: FieldAllowlist,
  records: readonly T[],
): Partial<T>[] {
  return records.map((r) => project(allowlist, r));
}

/** Test-only, named so it cannot read as legitimate application code. */
export function unsafeAllowlistForTests(
  role: Role,
  permitted: readonly string[],
  defaultOn: readonly string[] = [],
): FieldAllowlist {
  return mint(role, new Set(permitted), new Set(defaultOn));
}
