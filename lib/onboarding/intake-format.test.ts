import { describe, expect, it } from "vitest";

import {
  INTAKE_LABELS,
  formatIntakeForDoc,
  formatIntakeForPrompt,
  humanizeKey,
  looksLikeSlug,
  toLabeledAnswers,
  unmappedKeys,
} from "./intake-format";

/*
 * First tests for this module (story 5.12). It had none in `functions/`, and it
 * is the module standing between GHL's raw payload and a document the client
 * opens on day one.
 *
 * Its stated guarantee is blunt — "a raw slug never reaches the client Doc" —
 * and it was asserted only in a comment. The slug heuristic in particular is
 * the kind that looks obviously right and has a boundary case in the middle of
 * it: `taxAdvisoryOffer` and `NtTZgDgIImFyPVRtDVDL` are both 16+ characters
 * with no separators, and only capital density and an embedded digit separate
 * them.
 */

describe("looksLikeSlug", () => {
  it("accepts real words as readable", () => {
    for (const key of ["offer_description", "ideal_client", "taxAdvisoryOffer", "contact.first_name"]) {
      expect(looksLikeSlug(key), key).toBe(false);
    }
  });

  it("rejects GHL's opaque 20-character ids", () => {
    // Mapped or not, the heuristic must recognise the SHAPE — a mapping is a
    // label lookup, not a reason the key became readable.
    for (const key of ["suPpj9zBTX4coNoB61Iv", "NtTZgDgIImFyPVRtDVDL", "G3cR0ftsmKBokGAbE9Sr"]) {
      expect(looksLikeSlug(key), key).toBe(true);
    }
  });

  it("rejects hex blobs, uuids and bare numbers", () => {
    expect(looksLikeSlug("9f3ab21c")).toBe(true);
    expect(looksLikeSlug("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(looksLikeSlug("12345")).toBe(true);
  });

  it("treats a key that is only a noise prefix as a slug", () => {
    // Stripping leaves nothing readable behind.
    expect(looksLikeSlug("custom_field_")).toBe(true);
    expect(looksLikeSlug("contact.")).toBe(true);
  });

  it("keeps camelCase words that are long but low in capitals", () => {
    // The boundary the heuristic exists to hold: 16 chars, no separators, no
    // digit, 12.5% capitals. A slug of the same length runs 60%.
    expect(looksLikeSlug("taxAdvisoryOffer")).toBe(false);
  });
});

describe("humanizeKey", () => {
  it("reads snake_case, camelCase and prefixed keys the same way", () => {
    expect(humanizeKey("tax_advisory_offer").toLowerCase()).toContain("tax advisory offer");
    expect(humanizeKey("taxAdvisoryOffer").toLowerCase()).toContain("tax advisory offer");
    expect(humanizeKey("contact.ideal_client").toLowerCase()).toContain("ideal client");
  });
});

describe("formatIntakeForDoc", () => {
  it("NEVER emits a raw key, which is this module's whole guarantee", () => {
    // G3cR0ftsmKBokGAbE9Sr is in UNIDENTIFIED_FIELD_IDS: a real form field with
    // no label anyone could map. The unmapped path is the one that must not leak.
    const doc = formatIntakeForDoc({
      G3cR0ftsmKBokGAbE9Sr: "We help accountants raise fees",
      offer_description: "Tax advisory retainer",
    });
    expect(doc).not.toContain("G3cR0ftsmKBokGAbE9Sr");
  });

  it("keeps the answer even when the key is unusable", () => {
    // The client's own words are real content; the key is not.
    const doc = formatIntakeForDoc({ G3cR0ftsmKBokGAbE9Sr: "We help accountants raise fees" });
    expect(doc).toContain("We help accountants raise fees");
    expect(doc).toContain("Additional responses:");
  });

  it("drops empty answers rather than rendering a bare label", () => {
    const doc = formatIntakeForDoc({ offer_description: "", ideal_client: "CPAs" });
    expect(doc).not.toMatch(/^[^:\n]+:\s*$/m);
    expect(doc).toContain("CPAs");
  });

  it("renders arrays and objects without leaking JSON into a labelled line", () => {
    const doc = formatIntakeForDoc({ ideal_client: ["CPAs", "bookkeepers"] });
    expect(doc).toContain("CPAs, bookkeepers");
  });
});

describe("unmappedKeys", () => {
  it("names exactly the keys that need adding to INTAKE_LABELS", () => {
    const keys = unmappedKeys({
      offer_description: "x",
      G3cR0ftsmKBokGAbE9Sr: "y",
    });
    expect(keys).toEqual(["G3cR0ftsmKBokGAbE9Sr"]);
  });

  it("is empty when every key is mapped or readable", () => {
    expect(unmappedKeys({ offer_description: "x", ideal_client: "y" })).toEqual([]);
  });
});

describe("the label map itself", () => {
  it("maps every known GHL id to a non-empty readable label", () => {
    for (const [key, label] of Object.entries(INTAKE_LABELS)) {
      expect(label.trim().length, key).toBeGreaterThan(0);
      expect(looksLikeSlug(label), `label for ${key} is itself a slug`).toBe(false);
    }
  });
});

describe("formatIntakeForPrompt", () => {
  it("labels the payload rather than dumping JSON at the model", () => {
    const prompt = formatIntakeForPrompt({ offer_description: "Tax advisory retainer" });
    expect(prompt).toContain("Tax advisory retainer");
    expect(prompt).not.toContain('{"offer_description"');
  });
});

describe("toLabeledAnswers", () => {
  it("flags unlabelled answers so callers can route them", () => {
    const [mapped, slug] = toLabeledAnswers({
      offer_description: "a",
      G3cR0ftsmKBokGAbE9Sr: "b",
    });
    expect(mapped.unlabelled).toBe(false);
    expect(slug.unlabelled).toBe(true);
    expect(slug.label).toBe("");
  });
});
