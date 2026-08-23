import "server-only";

/**
 * Values that are not values: the store computes them at write time.
 *
 * Three exist in this codebase and none of them survive being passed through
 * the seam as plain data:
 *
 *   lib/bug-reports.ts:41       FieldValue.serverTimestamp()
 *   lib/onboarding/store.ts:39  FieldValue.delete()
 *   functions/src/firestore.ts  FieldValue.arrayUnion()   (out of 14.1 scope)
 *
 * They need naming here because each has a real but different Postgres
 * equivalent — `now()`, removing a JSON key, and an array append — and a
 * caller that reaches for the Firestore `FieldValue` directly has stepped
 * around the seam whether or not it imported `lib/firestore`.
 *
 * `serverTimestamp` matters beyond tidiness: the value is assigned by the
 * store, not the caller, so it does not drift with a caller's clock. Replacing
 * it with `Date.now()` during migration would be a silent behaviour change.
 */

const BRAND = "__tag_sentinel__";

export type Sentinel =
  | { readonly [BRAND]: "serverTimestamp" }
  | { readonly [BRAND]: "deleteField" }
  | { readonly [BRAND]: "arrayUnion"; readonly values: readonly unknown[] };

export function serverTimestamp(): Sentinel {
  return { [BRAND]: "serverTimestamp" };
}

export function deleteField(): Sentinel {
  return { [BRAND]: "deleteField" };
}

export function arrayUnion(...values: readonly unknown[]): Sentinel {
  return { [BRAND]: "arrayUnion", values };
}

export function isSentinel(value: unknown): value is Sentinel {
  return typeof value === "object" && value !== null && BRAND in value;
}

export function sentinelKind(value: Sentinel): "serverTimestamp" | "deleteField" | "arrayUnion" {
  return value[BRAND];
}

export function sentinelValues(value: Sentinel): readonly unknown[] {
  return BRAND in value && value[BRAND] === "arrayUnion" ? value.values : [];
}

/**
 * Walks one level deep as well as the top level: `lib/onboarding/store.ts`
 * writes `{ completedTasks: { [taskId]: deleteField() } }`, so a top-level-only
 * scan would miss the one live `deleteField` in the repo.
 */
export function mapSentinels(
  row: Record<string, unknown>,
  resolve: (sentinel: Sentinel) => unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isSentinel(value)) {
      out[key] = resolve(value);
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = mapSentinels(value as Record<string, unknown>, resolve);
    } else {
      out[key] = value;
    }
  }
  return out;
}
