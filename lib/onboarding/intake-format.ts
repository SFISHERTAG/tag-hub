/**
 * Turns raw intake payload keys into something a human should read.
 *
 * PORTED from `functions/src/intake-format.ts` on 2026-08-23, story 5.12.
 * Byte-identical apart from this note: it is a pure module with no imports, so
 * the port is a move rather than a rewrite, and anything that differs would be
 * a defect rather than an improvement.
 *
 * The `functions/` copy still exists because `phase2-intake-submit.ts` imports
 * it and deleting it would break that workspace's own build. That whole path is
 * undeployed and story 14.A removes it. Until then this is duplication, and it
 * is the kind CLAUDE.md warns about — recorded here so it is deliberate and
 * temporary rather than discovered later as drift.
 *
 * Two consumers, both currently fed the payload raw:
 *  - The client-facing Google Doc, built as `key: value` lines and shared with
 *    the client as reader (phase2-intake-submit.ts).
 *  - Four Gemini prompts, each embedding `JSON.stringify(intakeData)`.
 *
 * If GHL sends internal slugs rather than readable labels, the first renders
 * `contact.custom_field_9f3a: ...` in a document the client opens on day one,
 * and the second spends prompt budget on noise. The failure is silent in both
 * directions, so this module's guarantee is blunt: **a raw slug never reaches
 * the client Doc.** Unmappable keys have their answers kept and their keys
 * dropped, rather than the reverse.
 *
 * See docs/ONBOARDING_INTAKE_WIZARD_BRIEF.md §3e.
 */

/**
 * Exact key -> label overrides, read from the live intake form.
 *
 * GHL sends custom-field answers keyed by a 20-character opaque id
 * (`suPpj9zBTX4coNoB61Iv`), not by anything readable — so without this map the
 * client's onboarding Doc renders those ids and the Gemini prompts spend tokens
 * on them. 49 of the form's 57 fields are custom fields with such ids.
 *
 * **Both spellings are mapped for every field**, because which one arrives
 * depends on the delivery path: the form markup carries a readable `data-q`
 * name (`offer_description`) alongside the opaque `name`/`id`, and GHL's
 * webhook, its API, and a direct form POST do not all agree on which they send.
 * Mapping both costs nothing and removes the guess.
 *
 * Labels are the form's own field labels, so the Doc reads back to the client
 * in the words they answered under.
 *
 * Two fields on the form carry no readable name and are omitted deliberately —
 * see UNIDENTIFIED_FIELD_IDS below.
 */
export const INTAKE_LABELS: Record<string, string> = {
  "first_name": "First name",
  "last_name": "Last name",
  "phone": "Phone",
  "email": "Email",
  "city": "City",
  "state": "State",
  "postal_code": "Postal code",
  "website": "Website",
  "XN93DBmh427VgUhALOJk": "Years in business",
  "years_in_business": "Years in business",
  "4a60D0w4suKN7UqDujYk": "Primary service offering",
  "primary_service_offering": "Primary service offering",
  "YwIkumDMRObTbJJWNg3l": "Agreed to terms of service",
  "agreed_to_terms_of_service": "Agreed to terms of service",
  "e6ylG6fRingwdCADqK72": "Committed to full term",
  "committed_to_full_term": "Committed to full term",
  "HsqyevaXyJe7U2Zc8eBU": "Has run Facebook ads before",
  "has_run_facebook_ads_before": "Has run Facebook ads before",
  "Vr5PypcukBF8x3BJxWG2": "Has Facebook Business Manager",
  "has_facebook_business_manager": "Has Facebook Business Manager",
  "Tc8SrGRaaI5r3XWHY45v": "Has existing creative assets",
  "has_existing_creative_assets": "Has existing creative assets",
  "qa3lNr1dg5fISj17k2ge": "Comfortable on camera",
  "comfortable_on_camera": "Comfortable on camera",
  "sNXkbFBWHhompKF9Tojr": "Acknowledged responsibilities",
  "acknowledged_responsibilities": "Acknowledged responsibilities",
  "qjySqcfW9o5vAFjBrCT4": "Understands refund terms",
  "understands_refund_terms": "Understands refund terms",
  "k8iUwJUpdcwemolpus8T": "Initial payment submitted",
  "initial_payment_submitted": "Initial payment submitted",
  "suPpj9zBTX4coNoB61Iv": "Offer description",
  "offer_description": "Offer description",
  "CTsen0tJJkLapYgPCY6E": "Client outcomes",
  "client_outcomes": "Client outcomes",
  "Od3nlG970c1PAOhJhshe": "Advisory process",
  "advisory_process": "Advisory process",
  "IqGwy4ZQDC7AJEGRYIsA": "Offer differentiation",
  "offer_differentiation": "Offer differentiation",
  "ly0wwVKoc4gNFWwKlpXU": "Risk reversal or guarantee",
  "risk_reversal_or_guarantee": "Risk reversal or guarantee",
  "GBsibM4DVqZsnAw1Hp20": "Assessment / audit fee",
  "fee_assessment": "Assessment / audit fee",
  "4jWbjU1QAP3xGdnZb9SI": "Tax plan fee",
  "fee_tax_plan": "Tax plan fee",
  "khzBagfjsIzghRCDIOLy": "Implementation fee",
  "fee_implementation": "Implementation fee",
  "x94POJL7k66JfFRIw6TG": "Ongoing advisory / CFO fee",
  "fee_ongoing_advisory": "Ongoing advisory / CFO fee",
  "a1WlyuqhnaCpas1CT0gR": "Fee structure notes",
  "fee_structure_notes": "Fee structure notes",
  "bRreulCkcl7NGrXMoled": "Ideal client description",
  "ideal_client_description": "Ideal client description",
  "PHU4zOyP9vReSf2iKxUJ": "Best fit industries",
  "best_fit_industries": "Best fit industries",
  "v0NFmfGdMssImiIu9rnN": "Qualification threshold",
  "qualification_threshold": "Qualification threshold",
  "LwXHnYttEwCjj99l5nPn": "Best client traits",
  "best_client_traits": "Best client traits",
  "ddx6M3pxWsLGIGjPnvpq": "Biggest client problem",
  "biggest_client_problem": "Biggest client problem",
  "KhqE9KHw39auMbxH0zyv": "Client anxieties",
  "client_anxieties": "Client anxieties",
  "JM0hI4cdDQhPAsJEDCvx": "Buying trigger",
  "buying_trigger": "Buying trigger",
  "ZIoPC00xKM0CpztLMi9T": "Common prospect mistakes",
  "common_prospect_mistakes": "Common prospect mistakes",
  "a2sZrGhj02NgoaPivNcp": "Story 1 \u2014 client type",
  "story_1_client_type": "Story 1 \u2014 client type",
  "rZ7S36LTiRk3WqgQymMs": "Story 1 \u2014 original problem",
  "story_1_original_problem": "Story 1 \u2014 original problem",
  "jOLlxphQDnP63MlZAk4e": "Story 1 \u2014 strategies implemented",
  "story_1_strategies_implemented": "Story 1 \u2014 strategies implemented",
  "OnJrqdx1mpLGNpdUz5lH": "Story 1 \u2014 tax savings achieved",
  "story_1_tax_savings_achieved": "Story 1 \u2014 tax savings achieved",
  "r1ikJolKNOrJ202uuApX": "Story 1 \u2014 final outcome",
  "story_1_final_outcome": "Story 1 \u2014 final outcome",
  "cwqnllN7lyw9Mzlu2IBe": "Story 2 \u2014 client type",
  "story_2_client_type": "Story 2 \u2014 client type",
  "MYFvUF5HWzpEU4LA0wTf": "Story 2 \u2014 original problem",
  "story_2_original_problem": "Story 2 \u2014 original problem",
  "aqamIAtjYojvSZgOWBqX": "Story 2 \u2014 strategies implemented",
  "story_2_strategies_implemented": "Story 2 \u2014 strategies implemented",
  "ULN9ByCcQdQiWjvARbAF": "Story 2 \u2014 tax savings achieved",
  "story_2_tax_savings_achieved": "Story 2 \u2014 tax savings achieved",
  "3q3pCLAwVCPS9lpFqQmJ": "Story 2 \u2014 final outcome",
  "story_2_final_outcome": "Story 2 \u2014 final outcome",
  "1fMvXlz5mqibV0dtUJCa": "Story 3 \u2014 client type",
  "story_3_client_type": "Story 3 \u2014 client type",
  "v9legdaVXcFfhKER38LX": "Story 3 \u2014 original problem",
  "story_3_original_problem": "Story 3 \u2014 original problem",
  "2bIsYOTanT5VzhDQA1kL": "Story 3 \u2014 strategies implemented",
  "story_3_strategies_implemented": "Story 3 \u2014 strategies implemented",
  "xEHV5jim7MfmoR3HzX7W": "Story 3 \u2014 tax savings achieved",
  "story_3_tax_savings_achieved": "Story 3 \u2014 tax savings achieved",
  "n37eKxBRCwgaNkju84FE": "Story 3 \u2014 final outcome",
  "story_3_final_outcome": "Story 3 \u2014 final outcome",
  "m7AwxC6ufj4DcCmhCXbK": "Existing proof assets",
  "existing_proof_assets": "Existing proof assets",
  "8rXh1Vd005GpPAlXhVD9": "Largest savings result",
  "largest_savings_result": "Largest savings result",
  "NtTZgDgIImFyPVRtDVDL": "Named competitors",
  "named_competitors": "Named competitors",
  "EuRH8XJAz1ctOfWqXydq": "Competitive advantage",
  "competitive_advantage": "Competitive advantage",
  "cfTgz0NdB8qiHSttf11i": "Additional context",
  "additional_context": "Additional context",
};

/**
 * Custom fields present on the form with no `data-q` name and no visible label.
 *
 * Not guessed at. If either shows up in a payload it falls through to the
 * unmapped path — the answer is kept, shown under "Additional responses", and
 * logged by id so it can be identified in GHL and given a label here.
 */
export const UNIDENTIFIED_FIELD_IDS = [
  "G3cR0ftsmKBokGAbE9Sr",
  "5nIQL9guM2z62FZqF4hh",
] as const;

/** Prefixes GHL and form tools commonly bolt on. Stripped before humanizing. */
const NOISE_PREFIXES = ["contact.", "custom_field_", "customfield_", "cf_", "field_"];

/**
 * A key carrying no meaning for a reader: opaque ids, hex blobs, UUIDs, or what
 * is left when the prefix was the only readable part.
 */
export function looksLikeSlug(key: string): boolean {
  const bare = stripNoise(key);
  if (bare.length === 0) return true;
  if (/^[0-9a-f]{8,}$/i.test(bare)) return true;                    // hex blob
  if (/^[0-9a-f-]{32,}$/i.test(bare)) return true;                  // uuid-ish
  if (/^\d+$/.test(bare)) return true;                              // bare number
  if (!/[aeiou]/i.test(bare) && bare.length > 6) return true;       // no vowels, not a word

  // GHL's own ids: 20 characters, mixed case, no separators — e.g.
  // `suPpj9zBTX4coNoB61Iv`, `NtTZgDgIImFyPVRtDVDL`. Length alone cannot
  // separate these from a genuine camelCase key like `taxAdvisoryOffer`, which
  // is itself 16 characters, so two signals do it: an embedded digit, or a
  // capital density no word sequence reaches. `taxAdvisoryOffer` is 12.5%
  // capitals; `NtTZgDgIImFyPVRtDVDL` is 60%.
  if (bare.length >= 16 && !/[\s_-]/.test(bare)) {
    if (/\d/.test(bare)) return true;
    const capitals = (bare.match(/[A-Z]/g) ?? []).length;
    if (capitals / bare.length > 0.35) return true;
  }

  if (bare.length > 24 && !/[\s_-]/.test(bare)) return true;        // long unbroken token
  return false;
}

function stripNoise(key: string): string {
  let out = key.trim();
  for (const prefix of NOISE_PREFIXES) {
    if (out.toLowerCase().startsWith(prefix)) out = out.slice(prefix.length);
  }
  return out;
}

/** `tax_advisory_offer` / `taxAdvisoryOffer` / `contact.ideal_client` -> sentence case. */
export function humanizeKey(key: string): string {
  const words = stripNoise(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return "";
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export type LabeledAnswer = {
  key: string;
  /** Empty when the key was unmappable — the answer is kept, the key is not shown. */
  label: string;
  value: string;
  /** True when neither the map nor the humanizer produced anything readable. */
  unlabelled: boolean;
};

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(renderValue).filter(Boolean).join(", ");
  return JSON.stringify(value);
}

export function toLabeledAnswers(intakeData: Record<string, unknown>): LabeledAnswer[] {
  return Object.entries(intakeData).map(([key, raw]) => {
    const mapped = INTAKE_LABELS[key];
    const label = mapped ?? (looksLikeSlug(key) ? "" : humanizeKey(key));
    return { key, label, value: renderValue(raw), unlabelled: label.length === 0 };
  });
}

/** Slug-looking keys with no mapping. Log these — they are the list to add to INTAKE_LABELS. */
export function unmappedKeys(intakeData: Record<string, unknown>): string[] {
  return toLabeledAnswers(intakeData)
    .filter((a) => a.unlabelled)
    .map((a) => a.key);
}

/**
 * Client-facing. Never emits a raw key.
 *
 * Answers whose key could not be made readable still appear — they are the
 * client's own words and dropping them would lose real content — but under a
 * generic heading rather than beside a meaningless identifier.
 */
export function formatIntakeForDoc(intakeData: Record<string, unknown>): string {
  const answers = toLabeledAnswers(intakeData).filter((a) => a.value.length > 0);
  const labelled = answers.filter((a) => !a.unlabelled);
  const rest = answers.filter((a) => a.unlabelled);

  const parts = labelled.map((a) => `${a.label}: ${a.value}`);
  if (rest.length > 0) {
    parts.push("", "Additional responses:", ...rest.map((a) => `- ${a.value}`));
  }
  return parts.join("\n");
}

/**
 * Prompt-facing. Labels beat `JSON.stringify` here for the same reason they beat
 * it in the Doc: a model given `custom_field_9f3a` learns nothing from the key
 * and spends tokens on it.
 */
export function formatIntakeForPrompt(intakeData: Record<string, unknown>): string {
  const answers = toLabeledAnswers(intakeData).filter((a) => a.value.length > 0);
  const labelled = answers.filter((a) => !a.unlabelled);
  const rest = answers.filter((a) => a.unlabelled);

  const parts = labelled.map((a) => `${a.label}:\n${a.value}`);
  if (rest.length > 0) {
    parts.push("Additional context:", ...rest.map((a) => `- ${a.value}`));
  }
  return parts.join("\n\n");
}
