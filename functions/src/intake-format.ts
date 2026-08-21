/**
 * Turns raw intake payload keys into something a human should read.
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
 * Exact key -> label overrides.
 *
 * Empty until a real payload is captured — the same reasoning as METRIC_REGISTRY:
 * the safe machinery lands first, and exact mappings are added when the actual
 * keys are known rather than guessed. `humanizeKey` handles anything absent here,
 * so an empty map degrades to "readable" rather than to "broken".
 */
export const INTAKE_LABELS: Record<string, string> = {};

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
  if (bare.length > 24 && !/[\s_-]/.test(bare)) return true;        // long unbroken token
  if (!/[aeiou]/i.test(bare) && bare.length > 6) return true;       // no vowels, not a word
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
