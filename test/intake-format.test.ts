import { describe, expect, it } from "vitest";
import {
  formatIntakeForDoc,
  formatIntakeForPrompt,
  humanizeKey,
  looksLikeSlug,
  unmappedKeys,
  INTAKE_LABELS,
  UNIDENTIFIED_FIELD_IDS,
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


/**
 * Keys taken from the live intake form. These are the real GHL custom-field ids
 * and their `data-q` counterparts — the exact strings a payload will carry.
 */
describe("real intake form keys", () => {
  const REAL = [
    ["suPpj9zBTX4coNoB61Iv", "offer_description", "Offer description"],
    ["CTsen0tJJkLapYgPCY6E", "client_outcomes", "Client outcomes"],
    ["ddx6M3pxWsLGIGjPnvpq", "biggest_client_problem", "Biggest client problem"],
    ["8rXh1Vd005GpPAlXhVD9", "largest_savings_result", "Largest savings result"],
    ["k8iUwJUpdcwemolpus8T", "initial_payment_submitted", "Initial payment submitted"],
  ] as const;

  for (const [id, name, label] of REAL) {
    it(`${label} resolves from the opaque id`, () => {
      expect(formatIntakeForDoc({ [id]: "answer" })).toBe(`${label}: answer`);
    });
    it(`${label} resolves from the readable name`, () => {
      expect(formatIntakeForDoc({ [name]: "answer" })).toBe(`${label}: answer`);
    });
  }

  it("every opaque id would otherwise have been unreadable", () => {
    for (const [id] of REAL) {
      expect(looksLikeSlug(id)).toBe(true); // i.e. the map is doing real work
    }
  });

  it("maps both spellings for every custom field", () => {
    // 57 fields, 49 of them custom and therefore carrying two keys.
    expect(Object.keys(INTAKE_LABELS).length).toBe(57 + 49);
  });

  it("renders a realistic multi-field payload with no ids visible", () => {
    const doc = formatIntakeForDoc({
      suPpj9zBTX4coNoB61Iv: "We cut effective tax rate for CPAs.",
      bRreulCkcl7NGrXMoled: "Firms billing $1M+",
      x94POJL7k66JfFRIw6TG: "$2,500/mo",
    });
    expect(doc).toContain("Offer description: We cut effective tax rate for CPAs.");
    expect(doc).toContain("Ideal client description: Firms billing $1M+");
    expect(doc).toContain("Ongoing advisory / CFO fee: $2,500/mo");
    expect(doc).not.toMatch(/[A-Za-z0-9]{20}/);
    expect(doc).not.toContain("Additional responses");
  });

  it("the two unidentified fields fall through rather than being guessed at", () => {
    for (const id of UNIDENTIFIED_FIELD_IDS) {
      expect(INTAKE_LABELS[id]).toBeUndefined();
      const doc = formatIntakeForDoc({ [id]: "some answer" });
      expect(doc).not.toContain(id);
      expect(doc).toContain("some answer");
      expect(unmappedKeys({ [id]: "some answer" })).toEqual([id]);
    }
  });
});
