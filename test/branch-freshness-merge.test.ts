import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The failure this exists to catch, from 2026-08-27.
 *
 * check-branch-freshness refuses a commit on a branch more than MAX_BEHIND
 * behind origin/main, and prints `git merge origin/main` as the remedy. It then
 * refused the commit that completes that merge, because it measured `behind`
 * from HEAD and HEAD is still the pre-merge commit while a merge is resolving.
 * fix/alert-on-config-fault sat 25 behind and could not catch up: the guard
 * structurally forbade its own instruction.
 *
 * What triggers it is MERGE_HEAD, not conflicts. A first draft of this file
 * asserted that a clean merge never reaches the guard, on the reasoning that git
 * runs pre-merge-commit for it and that hook omits this check. The Reviewer
 * reproduced a clean merge that reached it anyway: pre-merge-commit runs OTHER
 * checks, one of them refused, and a refused merge stays in progress with
 * MERGE_HEAD set, so the only way to conclude it is `git commit`. Conflicts get
 * there by a different road to the same place. Tests 2 and 4 cover both roads,
 * because a suite that covered only one would have been built on the wrong
 * mechanism and passed anyway.
 *
 * Tests 2 and 4 are the discriminators: against the pre-fix script both exit 1.
 * Tests 1 and 3 exist to prove the fix did not simply switch the guard off,
 * which an early return on MERGE_HEAD alone would have done.
 */

const GUARD = fileURLToPath(new URL("../scripts/check-branch-freshness.mjs", import.meta.url));

// MAX_BEHIND is overridable, so the fixture needs four commits rather than
// twenty-one. The arithmetic under test does not care about the magnitude.
const MAX_BEHIND = "2";

let work: string;
let root: string;

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Runs a git command expected to fail, e.g. a merge that conflicts. */
function gitMayFail(cwd: string, args: string[]): void {
  try {
    git(cwd, args);
  } catch {
    /* the conflict is the point */
  }
}

function commit(cwd: string, file: string, body: string, message: string): void {
  writeFileSync(path.join(cwd, file), body);
  git(cwd, ["add", "-A"]);
  git(cwd, ["commit", "-q", "--no-verify", "-m", message]);
}

function runGuard(cwd: string): { code: number; output: string } {
  try {
    const out = execFileSync(process.execPath, [GUARD], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, TAG_MAX_BEHIND: MAX_BEHIND, TAG_STALE_OK: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output: out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "tag-freshness-"));
  const origin = path.join(root, "origin.git");
  work = path.join(root, "work");
  mkdirSync(work);

  git(root, ["init", "-q", "--bare", "-b", "main", origin]);
  git(work, ["init", "-q", "-b", "main"]);
  git(work, ["config", "user.email", "guard-test@example.invalid"]);
  git(work, ["config", "user.name", "guard test"]);
  git(work, ["config", "commit.gpgsign", "false"]);
  git(work, ["remote", "add", "origin", origin]);

  commit(work, "shared.txt", "base\n", "base");
  git(work, ["branch", "feature"]);

  // main moves four ahead, the last of them touching the file feature also edits.
  commit(work, "a.txt", "a\n", "main 1");
  commit(work, "b.txt", "b\n", "main 2");
  commit(work, "c.txt", "c\n", "main 3");
  commit(work, "shared.txt", "main version\n", "main 4, conflicting");
  git(work, ["push", "-q", "-u", "origin", "main"]);

  // feature: two commits of its own, one of them conflicting with main 4.
  git(work, ["switch", "-q", "feature"]);
  commit(work, "feature.txt", "feature\n", "feature 1");
  commit(work, "shared.txt", "feature version\n", "feature 2, conflicting");

  // A branch off feature that is NOT the base ref, for test 3.
  git(work, ["branch", "side"]);
  git(work, ["switch", "-q", "side"]);
  commit(work, "side.txt", "side\n", "side 1");

  // A second stale branch whose own work does NOT collide with main, so its
  // catch-up merges cleanly. Cut from the same base, so equally far behind.
  git(work, ["switch", "-q", "-c", "clean-feature", "main~4"]);
  commit(work, "clean.txt", "clean\n", "clean feature 1");

  git(work, ["switch", "-q", "feature"]);

  git(work, ["fetch", "-q", "origin"]);
});

// A failing assertion skips the abort at the end of its test and leaves the
// repo mid-merge, which then fails every later test for the wrong reason.
// That cascade masks which tests actually discriminate when this suite is run
// against the pre-fix guard to validate it.
afterEach(() => {
  try { git(work, ["merge", "--abort"]); } catch { /* no merge in progress */ }
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe("check-branch-freshness, merge in progress", () => {
  it("still refuses an ordinary commit on a branch past the limit", () => {
    expect(git(work, ["rev-list", "--count", "HEAD..origin/main"])).toBe("4");
    const r = runGuard(work);
    expect(r.code).toBe(1);
    expect(r.output).toContain("Refusing to commit");
  });

  /**
   * The discriminator. Against the pre-fix script this exits 1, because `behind`
   * is read from the pre-merge HEAD and is still 4.
   */
  it("permits the commit that completes a conflicted catch-up merge", () => {
    gitMayFail(work, ["merge", "--no-edit", "origin/main"]);
    expect(git(work, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"])).toBeTruthy();

    // Resolve as a human would, then ask the guard the question pre-commit asks.
    writeFileSync(path.join(work, "shared.txt"), "resolved\n");
    git(work, ["add", "-A"]);

    const r = runGuard(work);
    expect(r.output).not.toContain("Refusing to commit");
    expect(r.code).toBe(0);

    git(work, ["merge", "--abort"]);
  });

  /**
   * The fix must not degrade into "any merge is fine". An existence check on
   * MERGE_HEAD would pass this test wrongly.
   */
  it("still refuses a merge of an unrelated branch while the drift stands", () => {
    git(work, ["merge", "--no-commit", "--no-ff", "-q", "side"]);
    expect(git(work, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"])).toBeTruthy();

    const r = runGuard(work);
    expect(r.code).toBe(1);
    expect(r.output).toContain("Refusing to commit");
    // The count reported is what the merge would actually leave, not zero.
    expect(r.output).toMatch(/behind origin\/main: 4/);

    git(work, ["merge", "--abort"]);
  });

  /**
   * The Reviewer's actual case: no conflict anywhere, MERGE_HEAD set because
   * pre-merge-commit refused for an unrelated reason. `--no-commit` reproduces
   * that state without needing a hook installed in the fixture.
   */
  it("permits the commit that completes a CLEAN catch-up merge", () => {
    git(work, ["switch", "-q", "clean-feature"]);
    expect(git(work, ["rev-list", "--count", "HEAD..origin/main"])).toBe("4");

    git(work, ["merge", "--no-commit", "--no-ff", "-q", "origin/main"]);
    expect(git(work, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"])).toBeTruthy();
    expect(git(work, ["diff", "--name-only", "--diff-filter=U"])).toBe("");

    const r = runGuard(work);
    expect(r.output).not.toContain("Refusing to commit");
    expect(r.code).toBe(0);

    git(work, ["merge", "--abort"]);
    git(work, ["switch", "-q", "feature"]);
  });
});
