/**
 * The disclosure that travels with every payload built on fabricated numbers.
 *
 * Mirrors `SampleDataDisclosure` in `app/api/dashboard/_lib/sample-data.ts`.
 * It lives in `shared/` rather than in a feature because that is where the
 * server puts it too: `_lib/sample-data.ts` is a dashboard-level module shared
 * across widget routes, not a clients-level one. It sat under
 * `features/clients/` only because clients happened to be its first consumer,
 * and a second feature reaching across into the first one's folder is the shape
 * this barrel exists to prevent.
 *
 * `isSample` is read, never assumed. When the Meta integration lands and the
 * server flips its two constants, every notice in the app disappears on its
 * own; there is no second copy of "is this real yet" in the client to forget to
 * update.
 */
export interface SampleDataDisclosure {
  readonly isSample: boolean;
  /** Payload-rooted dotted paths the notice applies to. */
  readonly fields: readonly string[];
  /** Where the fabrication comes from, so a notice can name it. */
  readonly source: string;
  /** Human-readable, safe to render verbatim. */
  readonly notice: string;
}
