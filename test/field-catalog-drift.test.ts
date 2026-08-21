import { describe, expect, it } from "vitest";
import { FIELD_CATALOG } from "@/lib/dashboard/field-catalog.generated";
import {
  assertHeaderTotals,
  assertSectionCounts,
  parseFieldCatalog,
  ROLE_BY_COLUMN,
} from "../scripts/parse-field-catalog.mjs";

/**
 * docs/client-fields.md is the source of truth; the catalog is generated from it.
 *
 * This fails the moment the two disagree — someone edits the doc without
 * regenerating, or edits the generated file by hand. Either way the visibility
 * table and the code that enforces it have diverged, which is the only way an
 * allowlist quietly stops matching what was agreed.
 *
 * Regenerate with: node scripts/gen-field-catalog.mjs
 */

describe("generated field catalog matches docs/client-fields.md", () => {
  const parsed = parseFieldCatalog();

  it("has the same number of fields", () => {
    expect(Object.keys(FIELD_CATALOG).length).toBe(parsed.length);
  });

  /**
   * The assertion above compares the catalog to the parser that produced it,
   * so the two agree even when both are wrong — which is how a fixed column
   * offset dropped all nine rows of section 8 while this file reported no
   * drift. The section headings are the only counts a human wrote, so they
   * are the only ones that can contradict the parser.
   */
  it("parses as many fields as the doc's own section headings declare", () => {
    expect(() => assertSectionCounts(parsed)).not.toThrow();
  });

  /**
   * The doc opens with prose totals: how many fields, how many categories, how
   * many ship before Story 4.1. They are the last counts a human maintains, and
   * they were wrong for months because nothing read them.
   */
  it("matches the totals the doc's own summary claims", () => {
    expect(() => assertHeaderTotals(parsed)).not.toThrow();
  });

  it("has no field in the doc that is missing from the catalog", () => {
    const missing = parsed.filter((f) => !FIELD_CATALOG[f.id]).map((f) => f.id);
    expect(missing).toEqual([]);
  });

  for (const field of parsed) {
    it(`${field.id} visibility matches the doc`, () => {
      const generated = FIELD_CATALOG[field.id];
      expect(generated).toBeDefined();
      for (const role of Object.values(ROLE_BY_COLUMN)) {
        expect(generated.visibility[role]).toBe(field.visibility[role]);
      }
    });
  }
});
