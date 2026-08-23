/**
 * Detects a story document going backwards.
 *
 * Written 2026-08-23, after a session edited docs/stories/10.3 against an older
 * copy of the file. That commit added one genuine new task and, invisibly,
 * reverted five completed checkboxes and deleted the Dev Agent Record holding
 * both what had been built and why one requirement was rejected. Nothing
 * failed. The rejected requirement — a light/dark toggle for an app whose theme
 * file states it is dark-only by design — was re-added as an open task within
 * the hour.
 *
 * The class of bug is not carelessness. Every state that document passed
 * through is individually valid: an unchecked task is normal, a missing Dev
 * Agent Record is normal on a new story, "In Progress" is a real status.
 * check-story-status.mjs reads each version in isolation and finds nothing
 * wrong, because nothing is wrong in isolation. Only the *transition* is.
 *
 * So this compares a staged story against the committed one and objects to
 * three moves that only ever happen by accident:
 *
 *   - a task going from [x] to [ ]
 *   - the Dev Agent Record disappearing
 *   - Status moving backwards through the lifecycle
 *
 * All three are legitimate when deliberate, which is what the override is for.
 * The point is not to forbid them; it is to make them impossible to do without
 * noticing.
 */

/** Lifecycle order. A move to a lower index is a regression. */
const STATUS_ORDER = ["draft", "blocked", "ready", "in progress", "review", "done"];

function statusRank(text) {
  const m = text.match(/\*\*Status:\*\*\s*(.+)/i);
  if (!m) return null;
  const raw = m[1].trim().toLowerCase();
  // Statuses carry trailing prose ("Review — implemented 2026-08-23"), so match
  // on the longest known prefix rather than requiring an exact string.
  let best = null;
  for (let i = 0; i < STATUS_ORDER.length; i++) {
    if (raw.startsWith(STATUS_ORDER[i])) {
      if (best === null || STATUS_ORDER[i].length > STATUS_ORDER[best].length) best = i;
    }
  }
  return best;
}

/**
 * Task text, normalised for comparison.
 *
 * Strikethrough and trailing commentary are stripped, because the established
 * way to close a task that will not be done is to keep it visible, mark it
 * `[x]`, and strike it through with the reasoning appended. That must read as
 * the same task, or the convention this repo already uses would trip the check.
 */
function normaliseTask(text) {
  return text
    .replace(/~~/g, "")
    .replace(/\s+—\s.*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Every checkbox line, as a map of normalised text to checked state. */
function tasksOf(markdown) {
  const tasks = new Map();
  for (const line of markdown.split("\n")) {
    const m = line.match(/^\s*-\s\[([ xX])\]\s+(.*)$/);
    if (!m) continue;
    const key = normaliseTask(m[2]);
    if (!key) continue;
    // A task already recorded as checked stays checked: the same text can
    // appear twice, and the optimistic reading avoids a false positive.
    const checked = m[1].toLowerCase() === "x";
    tasks.set(key, tasks.get(key) === true ? true : checked);
  }
  return tasks;
}

function hasDevAgentRecord(markdown) {
  return /^#{2,3}\s+Dev Agent Record/im.test(markdown);
}

/**
 * @param {string|null} before Committed version, or null for a new file.
 * @param {string} after Staged version.
 */
export function compareStory(before, after) {
  const findings = [];
  if (before === null || before === undefined) return { ok: true, findings };

  const wasDone = tasksOf(before);
  const nowDone = tasksOf(after);

  for (const [task, checked] of wasDone) {
    if (!checked) continue;
    // A completed task that is gone entirely is a deletion, not a regression:
    // rewriting a task list is ordinary. Only a task still present and now
    // unchecked is the accident this catches.
    if (nowDone.has(task) && nowDone.get(task) === false) {
      findings.push(`task was completed and is now unchecked: "${task}"`);
    }
  }

  if (hasDevAgentRecord(before) && !hasDevAgentRecord(after)) {
    findings.push(
      "the Dev Agent Record was removed — it holds what was built and why, " +
        "including decisions that will otherwise be re-litigated",
    );
  }

  const beforeRank = statusRank(before);
  const afterRank = statusRank(after);
  if (beforeRank !== null && afterRank !== null && afterRank < beforeRank) {
    findings.push(
      `Status moved backwards, "${STATUS_ORDER[beforeRank]}" to "${STATUS_ORDER[afterRank]}"`,
    );
  }

  return { ok: findings.length === 0, findings };
}
