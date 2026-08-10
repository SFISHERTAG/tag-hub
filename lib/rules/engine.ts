import type { ConditionOperator, Rule, RuleCondition, RuleEvaluation, RuleSnapshot, RulesConfig } from "./types";

/**
 * The entire rules engine. Nothing in this file knows about clients, tenants,
 * or health signals — see engine.test.ts for the genericity proof (two
 * unrelated configs through this one function, plus a check that this file's
 * source never names a specific product concept).
 */

function conditionHolds(condition: RuleCondition, snapshot: RuleSnapshot, missing: Set<string>): boolean {
  const actual = snapshot[condition.field];

  if (actual === undefined) {
    missing.add(condition.field);
    return false; // a condition on a missing field fails closed, not open
  }

  if (condition.operator === "eq") return actual === condition.value;
  if (condition.operator === "neq") return actual !== condition.value;

  // lt / lte / gt / gte only make sense for numbers. Fail loud on a config
  // mistake (e.g. a relational operator on a status string) rather than
  // silently coercing and returning a wrong bucket.
  if (typeof actual !== "number" || typeof condition.value !== "number") {
    throw new Error(
      `Rule condition on field "${condition.field}" uses operator "${condition.operator}", which requires numeric values. ` +
        `Got snapshot value of type "${typeof actual}" and config value of type "${typeof condition.value}".`,
    );
  }

  const op: ConditionOperator = condition.operator;
  if (op === "lt") return actual < condition.value;
  if (op === "lte") return actual <= condition.value;
  if (op === "gt") return actual > condition.value;
  return actual >= condition.value; // gte
}

function ruleMatches(rule: Rule, snapshot: RuleSnapshot, missing: Set<string>): boolean {
  return rule.when.every((condition) => conditionHolds(condition, snapshot, missing));
}

/**
 * Evaluate a snapshot against a config's rules, in order. Returns the first
 * fully-matching rule's bucket, or the config's defaultBucket if none match.
 */
export function evaluateRules(config: RulesConfig, snapshot: RuleSnapshot): RuleEvaluation {
  const missing = new Set<string>();

  for (const rule of config.rules) {
    if (ruleMatches(rule, snapshot, missing)) {
      return {
        configId: config.id,
        bucket: rule.bucket,
        matchedRuleId: rule.id,
        matchedRuleLabel: rule.label,
        missingFields: Array.from(missing),
      };
    }
  }

  return {
    configId: config.id,
    bucket: config.defaultBucket,
    matchedRuleId: null,
    matchedRuleLabel: null,
    missingFields: Array.from(missing),
  };
}
