/**
 * Wire shapes for `/api/admin/knowledge-base*`, mirrored from
 * lib/knowledge-base/types.ts.
 *
 * `blocks` stays a loose union on purpose: the source manual carries six block
 * types with different shapes and new ones appear per page, so the editor edits
 * them as raw JSON rather than through per-type form fields. The one invariant
 * both the editor and every renderer rely on is that a block is an object with
 * a string `type`.
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

export type ManualPageSummary = Pick<
  ManualPage,
  'id' | 'num' | 'title' | 'eyebrow' | 'status'
>;

export interface ManualPageVersion {
  readonly id: string;
  readonly page: ManualPage;
  readonly authorUid: string;
  readonly authorEmail: string;
  /** Epoch milliseconds. */
  readonly createdAt: number;
}

export interface ManualPageList {
  readonly pages: readonly ManualPageSummary[];
}

export interface ManualPageDetail {
  readonly page: ManualPage;
}

export interface ManualPageHistory {
  /** Newest first, as the endpoint returns them. */
  readonly versions: readonly ManualPageVersion[];
}

/** Exactly what `PUT /api/admin/knowledge-base/[pageId]` accepts. */
export type ManualPageDraft = Omit<ManualPage, 'id'>;

export interface Acknowledged {
  readonly ok: true;
}

/**
 * Parses the blocks textarea, keeping "not JSON" and "not an array" as
 * distinct, quotable failures instead of one generic message.
 *
 * Returned as a result rather than thrown because the caller is a form: the
 * message goes next to the field, and a throw here would either be swallowed
 * or take down a change-detection pass.
 */
export type BlocksParse =
  | { readonly ok: true; readonly blocks: ManualBlock[] }
  | { readonly ok: false; readonly error: string };

export function parseBlocks(raw: string): BlocksParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Blocks is not valid JSON.' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Blocks must be a JSON array.' };
  }

  const blocks: ManualBlock[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `Block ${index} must be an object.` };
    }
    const block = entry as Record<string, unknown>;
    if (typeof block['type'] !== 'string' || !block['type']) {
      return { ok: false, error: `Block ${index} needs a non-empty "type".` };
    }
    blocks.push(block as ManualBlock);
  }

  return { ok: true, blocks };
}
