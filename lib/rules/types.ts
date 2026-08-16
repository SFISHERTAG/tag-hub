/**
 * Rules engine.
 *
 * A weighted score (0-100) is the wrong shape for escalation logic like story
 * 3.6's Ascension / At-Risk / No-Action buckets: "show rate < 15% OR delivery
 * stalled OR no check-in in 30 days" loses its meaning the moment you average
 * it into one number — a client can be at-risk for any one of those reasons
 * alone. What that needs is ordered rules that each either match or don't,
 * AND-ing their own conditions, with separate rules covering separate OR
 * branches into the same bucket.
 *
 * This module knows nothing about clients, health, or TAG. A config supplies
 * the fields, conditions, and bucket names; lib/rules/engine.ts just
 * evaluates a snapshot against them. See lib/rules/configs/ for the actual
 * client configs.
 */

export type ConditionOperator = "lt" | "lte" | "gt" | "gte" | "eq" | "neq";

export interface RuleCondition {
  /** Key read from the snapshot passed to evaluateRules(). */
  field: string;
  operator: ConditionOperator;
  value: number | string | boolean;
}

export interface Rule {
  id: string;
  label: string;
  /** Bucket this rule resolves to when every condition in `when` holds. */
  bucket: string;
  /**
   * All conditions must hold (AND). To express an OR into the same bucket,
   * add a second Rule rather than trying to encode OR inside one rule.
   */
  when: RuleCondition[];
}

export interface RulesConfig {
  id: string;
  label: string;
  /** Evaluated in array order; the first fully-matching rule wins. Order most-severe-first. */
  rules: Rule[];
  /** Bucket returned when no rule matches. */
  defaultBucket: string;
}

/** field -> raw value. Not pre-normalized — conditions compare these directly. */
export type RuleSnapshot = Record<string, number | string | boolean | undefined>;

export interface RuleEvaluation {
  configId: string;
  bucket: string;
  matchedRuleId: string | null;
  matchedRuleLabel: string | null;
  /**
   * Fields at least one evaluated rule referenced but that were undefined in
   * the snapshot. Best-effort, not exhaustive — a rule short-circuits on its
   * first failing condition, so a later condition's missing field in the same
   * rule won't be recorded. Good enough to catch "the config references a
   * field nobody is computing yet."
   */
  missingFields: string[];
}
