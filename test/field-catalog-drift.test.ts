import { describe, expect, it } from "vitest";
import { FIELD_CATALOG } from "@/lib/dashboard/field-catalog.generated";
import { parseFieldCatalog, ROLE_BY_COLUMN } from "../scripts/parse-field-catalog.mjs";

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

  it("has no field in the doc that is missing from the catalog", () => {
    const missing = parsed.filter((f) => !FIELD_CATALOG[f.id]).map((f) => f.id);
    expect(missing).toEqual([]);
  });

  for (const field of parsed) {
    it(`${field.id} visibility matches the doc`, () => {
      const generated = FIELD_CATALOG[field.id];
      expect(generated).toBeDefined();
      for (const role of Object.values(ROLE_BY_COLUMN)) {
        expect(generated.visibility[role as keyof typeof generated.visibility]).toBe(
          field.visibility[role],
        );
      }
    });
  }
});
