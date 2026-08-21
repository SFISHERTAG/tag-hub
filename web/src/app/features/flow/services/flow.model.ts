/**
 * Wire shapes for `/api/flow/**`, mirrored from lib/flow/types.ts.
 *
 * Field names are snake_case because that is what the endpoints return — these
 * rows come straight out of Postgres. Renaming them here would mean a mapping
 * layer whose only job is to disagree with the network tab.
 *
 * Dates are strings, not `Date`: they are `Date` in lib/ and ISO strings once
 * they have crossed JSON. Typing them as `Date` compiles and then fails at the
 * first `.getTime()`.
 */
export interface FlowScript {
  readonly id: string;
  readonly card_id: string;
  readonly content: string;
  readonly why: string | null;
  readonly notes: string | null;
  readonly version_tag: string | null;
  readonly tags: readonly string[];
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface FlowCard {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly sub_label: string | null;
  readonly script: FlowScript | null;
}

export interface FlowSection {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly cards: readonly FlowCard[];
}

export interface FlowTab {
  readonly id: string;
  readonly label: string;
  readonly icon: string | null;
  readonly color: string | null;
  readonly sections: readonly FlowSection[];
}

export interface FullFramework {
  readonly id: string;
  readonly version: string;
  readonly tabs: readonly FlowTab[];
}

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface FlowScriptSuggestion {
  readonly id: string;
  readonly org_id: string;
  readonly card_id: string;
  readonly suggested_content: string;
  readonly suggested_why: string | null;
  readonly suggested_notes: string | null;
  readonly suggestion_note: string | null;
  readonly status: SuggestionStatus;
  readonly suggested_by: string;
  readonly created_at: string;
  readonly reviewed_by: string | null;
  readonly reviewed_at: string | null;
  readonly review_note: string | null;
  readonly resulting_script_id: string | null;
}

export interface NewSuggestion {
  readonly orgId: string;
  readonly cardId: string;
  readonly content: string;
  readonly note: string;
}

export type SuggestionAction = 'approve' | 'reject';
