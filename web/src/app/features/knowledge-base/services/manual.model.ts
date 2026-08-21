/**
 * Wire shapes for the read-only `/api/knowledge-base*` endpoints, mirrored from
 * lib/knowledge-base/types.ts.
 *
 * Declared here rather than imported from features/admin: a feature module may
 * not import a sibling (CLAUDE.md, architecture isolation).
 */
export type ManualBlock = Record<string, unknown> & { type: string };

export interface ManualPage {
  readonly id: string;
  readonly num: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly lede: string;
  readonly status: string;
  readonly level: string;
  readonly blocks: readonly ManualBlock[];
}

export type ManualPageSummary = Pick<ManualPage, 'id' | 'num' | 'title' | 'eyebrow' | 'status'>;

export interface ManualPageList {
  readonly pages: readonly ManualPageSummary[];
}

export interface ManualPageDetail {
  readonly page: ManualPage;
}

/* ── Block narrowing ──────────────────────────────────────────────────────
 * `blocks` is deliberately loose on the wire, so every read here is a checked
 * one. The rule the renderer follows: a field that is not the expected type is
 * treated as absent, and a block whose `type` is unrecognised is dumped as raw
 * JSON rather than dropped.
 *
 * Content that silently disappears is the worst outcome for a manual — someone
 * follows a procedure with a step missing and never learns there was one.
 */

export function textField(block: ManualBlock, key: string): string | null {
  const value = block[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function stringList(block: ManualBlock, key: string): readonly string[] {
  const value = block[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function stringGrid(block: ManualBlock, key: string): readonly (readonly string[])[] {
  const value = block[key];
  if (!Array.isArray(value)) return [];
  return value.map((row) =>
    Array.isArray(row) ? row.filter((cell): cell is string => typeof cell === 'string') : [],
  );
}

export interface InstrumentField {
  readonly label: string;
  readonly defaultValue: string | null;
}

export function instrumentFields(block: ManualBlock, key: string): readonly InstrumentField[] {
  const value = block[key];
  if (!Array.isArray(value)) return [];

  const fields: InstrumentField[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record['label'] === 'string' ? record['label'] : null;
    if (!label) continue;
    fields.push({
      label,
      defaultValue: typeof record['default'] === 'string' ? record['default'] : null,
    });
  }
  return fields;
}

/** `severity` drives the note's tone. Anything unrecognised falls back to info. */
export type NoteSeverity = 'hard' | 'good' | 'info';

export function noteSeverity(block: ManualBlock): NoteSeverity {
  const value = block['severity'];
  return value === 'hard' || value === 'good' ? value : 'info';
}

export function rawJson(block: ManualBlock): string {
  return JSON.stringify(block, null, 2);
}
