import "server-only";

import { Timestamp } from "@google-cloud/firestore";

/**
 * A codec maps one stored row to its domain shape and back.
 *
 * It exists because two paths store `Timestamp` where the domain wants epoch
 * millis (`authCodes.expiresAt`, `authCodeCooldowns.lastIssuedAt`). Normalising
 * inside the accessor keeps `Timestamp` from crossing the seam, which is the
 * whole point — 14.2's Postgres implementation supplies its own codec for the
 * same paths and no call site changes.
 */
export type Codec<T> = {
  readonly toStore: (value: T) => Record<string, unknown>;
  readonly fromStore: (row: Record<string, unknown>) => T;
};

/** The default: the stored row is the domain shape. */
export function identityCodec<T>(): Codec<T> {
  return {
    toStore: (value) => value as unknown as Record<string, unknown>,
    fromStore: (row) => row as unknown as T,
  };
}

/**
 * Reads a field that may be a Firestore `Timestamp` or already epoch millis.
 *
 * Both forms are live: documents written before a given path was normalised
 * hold a `Timestamp`, and ones written after hold a number.
 */
export function millisFrom(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return 0;
}

/** Builds a codec that converts the named fields between `Timestamp` and millis. */
export function timestampCodec<T>(fields: readonly (keyof T & string)[]): Codec<T> {
  return {
    toStore: (value) => {
      const row = { ...(value as unknown as Record<string, unknown>) };
      for (const field of fields) {
        const raw = row[field];
        if (typeof raw === "number") row[field] = Timestamp.fromMillis(raw);
      }
      return row;
    },
    fromStore: (row) => {
      const next = { ...row };
      for (const field of fields) next[field] = millisFrom(row[field]);
      return next as unknown as T;
    },
  };
}
