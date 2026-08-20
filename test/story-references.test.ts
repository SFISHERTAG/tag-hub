import { describe, expect, it } from "vitest";
import { extractReferencedFiles } from "../scripts/lib/story-references.mjs";

describe("extractReferencedFiles", () => {
  it("matches a file-list bullet with a markdown link", () => {
    const text = "- [`lib/meta/ads.ts`](../../lib/meta/ads.ts) — existing `getAdSpend`";
    expect(extractReferencedFiles(text)).toEqual(["lib/meta/ads.ts"]);
  });

  it("matches a file-list bullet without a markdown link", () => {
    const text = "- `lib/dashboard/ad-spend.ts` — new module";
    expect(extractReferencedFiles(text)).toEqual(["lib/dashboard/ad-spend.ts"]);
  });

  it("ignores a bare filename with no path separator, used as shorthand in prose", () => {
    const text = "Storage fix pulled `db.ts`'s field (de)serialization into a shared module.";
    expect(extractReferencedFiles(text)).toEqual([]);
  });

  it("ignores a full-path reference embedded mid-sentence, not at the start of a bullet", () => {
    const text =
      "were indistinguishable; `lib/dashboard/roas.ts` (Story 4.4) already had an outer catch";
    expect(extractReferencedFiles(text)).toEqual([]);
  });

  it("ignores a full-path reference inside a prose aside explaining what wasn't run", () => {
    const text =
      "Verifying the signed-in view requires TEST_AUTH_ENABLED=true " +
      "(`app/api/auth/test-signin/route.ts` calls `adminAuth().createCustomToken`) " +
      "— not configured in this environment.";
    expect(extractReferencedFiles(text)).toEqual([]);
  });

  it("matches multiple genuine bullets and skips prose in between", () => {
    const text = [
      "- [`lib/a/one.ts`](../../lib/a/one.ts) — first",
      "  some prose mentioning `lib/b/two.ts` in passing, not a bullet",
      "- [`lib/c/three.ts`](../../lib/c/three.ts) — third",
    ].join("\n");
    expect(extractReferencedFiles(text)).toEqual(["lib/a/one.ts", "lib/c/three.ts"]);
  });
});
