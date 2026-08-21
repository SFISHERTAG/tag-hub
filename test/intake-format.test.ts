import { describe, expect, it } from "vitest";
import {
  formatIntakeForDoc,
  formatIntakeForPrompt,
  humanizeKey,
  looksLikeSlug,
  unmappedKeys,
} from "../functions/src/intake-format";

/**
 * The guarantee under test is narrow and absolute: no raw key reaches the
 * client-facing Google Doc. Everything else here is quality; this one is the
 * thing a client would see on day one.
 */

const SLUGS = [
  "contact.custom_field_9f3a2b1c",
  "custom_field_a1b2c3d4e5",
  "cf_00000000-0000-0000-0000-000000000000",
  "field_12345",
  "contact.",
  "xkcdzqrtplmn",
];

const READABLE = {
  tax_advisory_offer: "Tax advisory offer",
  taxAdvisoryOffer: "Tax advisory offer",
  "contact.ideal_client": "Ideal client",
  "biggest-problem": "Biggest problem",
};

describe("slug detection", () => {
  for (const key of SLUGS) {
    it(`treats ${key} as unreadable`, () => expect(looksLikeSlug(key)).toBe(true));
  }
  for (const key of Object.keys(READABLE)) {
    it(`treats ${key} as readable`, () => expect(looksLikeSlug(key)).toBe(false));
  }
});

describe("humanizeKey", () => {
  for (const [key, expected] of Object.entries(READABLE)) {
    it(`${key} -> ${expected}`, () => expect(humanizeKey(key)).toBe(expected));
  }
});

describe("the client Doc never shows a raw key", () => {
  it("omits slug keys while keeping their answers", () => {
    const payload = Object.fromEntries(SLUGS.map((s, i) => [s, `answer ${i}`]));
    const doc = formatIntakeForDoc(payload);

    for (const slug of SLUGS) {
      expect(doc).not.toContain(slug);
    }
    // The client's own words survive — dropping them would lose real content.
    for (let i = 0; i < SLUGS.length; i++) {
      expect(doc).toContain(`answer ${i}`);
    }
    expect(doc).toContain("Additional responses:");
  });

  it("labels readable keys properly", () => {
    const doc = formatIntakeForDoc({ tax_advisory_offer: "We cut tax liability." });
    expect(doc).toBe("Tax advisory offer: We cut tax liability.");
  });

  it("handles a mixed payload without leaking the slug half", () => {
    const doc = formatIntakeForDoc({
      ideal_client: "CPAs doing $1M+",
      "contact.custom_field_9f3a2b1c": "Hidden key, real answer",
    });
    expect(doc).toContain("Ideal client: CPAs doing $1M+");
    expect(doc).not.toContain("custom_field");
    expect(doc).toContain("Hidden key, real answer");
  });

  it("drops empty answers rather than printing dangling labels", () => {
    expect(formatIntakeForDoc({ ideal_client: "", other: null })).toBe("");
  });

  it("renders arrays and objects without dumping JSON at the client", () => {
    const doc = formatIntakeForDoc({ outcomes: ["Lower tax", "Better structure"] });
    expect(doc).toBe("Outcomes: Lower tax, Better structure");
  });
});

describe("prompt formatting", () => {
  it("gives the model labels instead of slugs", () => {
    const prompt = formatIntakeForPrompt({
      tax_advisory_offer: "We cut tax liability.",
      "custom_field_a1b2c3d4e5": "Some answer",
    });
    expect(prompt).toContain("Tax advisory offer:");
    expect(prompt).not.toContain("custom_field");
    expect(prompt).toContain("Some answer");
  });
});

describe("unmappedKeys", () => {
  it("reports exactly the keys needing a label, for the log line", () => {
    expect(unmappedKeys({ ideal_client: "x", "cf_9f3a2b1c": "y" })).toEqual(["cf_9f3a2b1c"]);
  });
});
