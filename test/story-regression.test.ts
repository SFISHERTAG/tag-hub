import { describe, expect, it } from "vitest";
import { compareStory } from "../scripts/lib/story-regression.mjs";

/**
 * The failure this exists to catch, from 2026-08-23.
 *
 * A session edited docs/stories/10.3 against an older copy of the file. The
 * commit added one genuine new task and, invisibly, reverted five completed
 * checkboxes and deleted the Dev Agent Record recording what had been built and
 * why one requirement was rejected. Nothing failed. The rejected requirement was
 * re-added as an open task within the hour.
 *
 * The class of bug is not "someone was careless". It is that a story document
 * can go backwards and no gate reads it as a regression, because every
 * individual state it passes through is valid on its own.
 */

const done = `# Story X
**Status:** Review

## Tasks
- [x] first
- [x] second

## Dev Agent Record
Built it.
`;

describe("compareStory", () => {
  it("passes when nothing regressed", () => {
    const r = compareStory(done, done);
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it("passes when a new unchecked task is added, which is a normal reopening", () => {
    const after = done.replace("- [x] second", "- [x] second\n- [ ] third");
    expect(compareStory(done, after).ok).toBe(true);
  });

  it("catches a completed task being unchecked", () => {
    const after = done.replace("- [x] second", "- [ ] second");
    const r = compareStory(done, after);
    expect(r.ok).toBe(false);
    expect(r.findings.join(" ")).toContain("second");
  });

  it("catches every unchecked task, not just the first", () => {
    const after = done.replace("- [x] first", "- [ ] first").replace("- [x] second", "- [ ] second");
    expect(compareStory(done, after).findings).toHaveLength(2);
  });

  it("catches the Dev Agent Record being deleted", () => {
    const after = done.split("## Dev Agent Record")[0];
    const r = compareStory(done, after);
    expect(r.ok).toBe(false);
    expect(r.findings.join(" ")).toContain("Dev Agent Record");
  });

  it("catches Status moving backwards", () => {
    const after = done.replace("**Status:** Review", "**Status:** In Progress");
    const r = compareStory(done, after);
    expect(r.ok).toBe(false);
    expect(r.findings.join(" ")).toMatch(/Status/i);
  });

  /**
   * Status forward is ordinary progress and must not be flagged, or the check
   * fires on every story that finishes and gets muted.
   */
  it("allows Status moving forwards", () => {
    const before = done.replace("**Status:** Review", "**Status:** In Progress");
    expect(compareStory(before, done).ok).toBe(true);
  });

  it("allows a task to be struck through rather than unchecked", () => {
    // The rejection pattern: kept visible and marked done-by-decision.
    const after = done.replace("- [x] second", "- [x] ~~second~~ — rejected, see notes");
    expect(compareStory(done, after).ok).toBe(true);
  });

  it("treats a brand new story as nothing to compare", () => {
    expect(compareStory(null, done).ok).toBe(true);
  });

  it("matches tasks by their text, so reordering is not a regression", () => {
    const after = `# Story X
**Status:** Review

## Tasks
- [x] second
- [x] first

## Dev Agent Record
Built it.
`;
    expect(compareStory(done, after).ok).toBe(true);
  });
});
