import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The failure this exists to catch, from 2026-08-27.
 *
 * check-story-regression compares the staged story against `HEAD:<path>`. During
 * a merge HEAD is the pre-merge tip, so on a branch catching up it compares
 * against its own stale copy. Every deliberate correction main has made since
 * the branch was cut then reads as that branch going backwards.
 *
 * It refused fix/alert-on-config-fault's catch-up over
 * docs/stories/4.4-roas-joined-on-utmadid.md: Status "done" on the branch,
 * "ready" on main, because main had corrected it after finding the story was not
 * done. The check's own message told the branch to run the merge it was
 * refusing, and check-branch-freshness said the same thing from the other side.
 * A stale branch could not catch up at all.
 *
 * The fix counts a finding only when it holds against BOTH parents. Test 2 is
 * the discriminator. Tests 1 and 3 prove it did not simply stop checking merges.
 */

const GUARD = fileURLToPath(new URL("../scripts/check-story-regression.mjs", import.meta.url));

let repo: string;
let root: string;

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function story(status: string, tasks: string): string {
  return `# Story 4.4\n**Status:** ${status}\n\n## Tasks\n${tasks}\n\n## Dev Agent Record\nBuilt it.\n`;
}

const DOC = "docs/stories/4.4-roas-joined-on-utmadid.md";

function write(body: string): void {
  writeFileSync(path.join(repo, DOC), body);
}

function commit(message: string): void {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "--no-verify", "-m", message]);
}

function runGuard(): { code: number; output: string } {
  try {
    const out = execFileSync(process.execPath, [GUARD], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, TAG_STORY_REOPEN_OK: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output: out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "tag-story-regression-"));
  repo = path.join(root, "repo");
  git(root, ["init", "-q", "-b", "main", repo]);
  git(repo, ["config", "user.email", "guard-test@example.invalid"]);
  git(repo, ["config", "user.name", "guard test"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  execFileSync("mkdir", ["-p", path.join(repo, "docs/stories")]);

  write(story("in progress", "- [x] first\n- [ ] second"));
  commit("base");
  git(repo, ["branch", "stale"]);

  // main corrects the story downwards, which is a legitimate correction.
  write(story("ready", "- [x] first\n- [ ] second"));
  commit("main: 4.4 was never done, back to ready");

  // The stale branch had marked it done before that correction landed.
  git(repo, ["switch", "-q", "stale"]);
  write(story("done", "- [x] first\n- [x] second"));
  commit("stale: 4.4 done");
});

// A failing assertion skips the abort at the end of its test and leaves the
// repo mid-merge, which then fails every later test for the wrong reason.
// That cascade masks which tests actually discriminate when this suite is run
// against the pre-fix guard to validate it.
afterEach(() => {
  try { git(repo, ["merge", "--abort"]); } catch { /* no merge in progress */ }
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe("check-story-regression, merge in progress", () => {
  it("still refuses an ordinary commit that walks a story backwards", () => {
    write(story("draft", "- [ ] first\n- [ ] second"));
    git(repo, ["add", "-A"]);

    const r = runGuard();
    expect(r.code).toBe(1);
    expect(r.output).toContain("going backwards");

    // Reset hard: `checkout -- <path>` restores from the index, which still
    // holds the staged draft, and would leave the tree dirty for the merges below.
    git(repo, ["reset", "-q", "--hard", "HEAD"]);
  });

  /**
   * The discriminator. Against the pre-fix script this exits 1, reporting
   * `Status moved backwards, "done" to "ready"` on a merge that only takes
   * main's already-reviewed correction.
   */
  it("permits a catch-up merge that takes the other parent's correction", () => {
    try {
      git(repo, ["merge", "--no-commit", "--no-ff", "-q", "main"]);
    } catch {
      /* conflict is fine, we resolve to main's version below */
    }
    expect(git(repo, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"])).toBeTruthy();

    // Resolve exactly as taking the incoming side would.
    write(story("ready", "- [x] first\n- [ ] second"));
    git(repo, ["add", "-A"]);

    const r = runGuard();
    expect(r.output).not.toContain("going backwards");
    expect(r.code).toBe(0);

    git(repo, ["merge", "--abort"]);
  });

  /**
   * The fix must not degrade into "any merge is fine". A resolution that
   * produces a state present on NEITHER parent is the merge's own invention.
   */
  it("still refuses a resolution that regresses against both parents", () => {
    try {
      git(repo, ["merge", "--no-commit", "--no-ff", "-q", "main"]);
    } catch {
      /* as above */
    }
    expect(git(repo, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"])).toBeTruthy();

    // Lower than "done" on the branch and lower than "ready" on main, and the
    // Dev Agent Record dropped. Neither parent says this.
    writeFileSync(
      path.join(repo, DOC),
      "# Story 4.4\n**Status:** draft\n\n## Tasks\n- [ ] first\n- [ ] second\n",
    );
    git(repo, ["add", "-A"]);

    const r = runGuard();
    expect(r.code).toBe(1);
    expect(r.output).toContain("going backwards");

    git(repo, ["merge", "--abort"]);
  });
});

/**
 * The invocation path, added 2026-08-27 after the first fix shipped inert.
 *
 * The suite above validated the guard by CALLING it. That is the code path, and
 * it is not where the guard runs first. `pre-merge-commit` fires on a clean
 * merge, before git writes MERGE_HEAD, so the merge-aware branch returned null
 * exactly there and the pre-fix single-parent behaviour ran. The clean catch-up
 * was refused, the refusal left MERGE_HEAD behind, and the retry through
 * `git commit` then passed. Two commands, one false refusal, and seven green
 * tests that never noticed, because every one of them concluded its merge with
 * `git commit`.
 *
 * So this block installs the hook and asserts on `git merge`'s own exit code.
 * A test that exercises the code path and not the invocation path is the
 * discriminating-nothing failure one level up.
 */
describe("check-story-regression, invoked from pre-merge-commit", () => {
  let hookRepo: string;
  let hookRoot: string;

  const DOC2 = "docs/stories/4.4-roas-joined-on-utmadid.md";

  beforeAll(() => {
    hookRoot = mkdtempSync(path.join(tmpdir(), "tag-premerge-"));
    hookRepo = path.join(hookRoot, "repo");
    git(hookRoot, ["init", "-q", "-b", "main", hookRepo]);
    git(hookRepo, ["config", "user.email", "guard-test@example.invalid"]);
    git(hookRepo, ["config", "user.name", "guard test"]);
    git(hookRepo, ["config", "commit.gpgsign", "false"]);
    execFileSync("mkdir", ["-p", path.join(hookRepo, "docs/stories")]);

    const doc = (status: string) =>
      `# Story 4.4\n**Status:** ${status}\n\n## Tasks\n- [x] first\n\n## Dev Agent Record\nBuilt it.\n`;

    writeFileSync(path.join(hookRepo, DOC2), doc("done"));
    writeFileSync(path.join(hookRepo, "other.txt"), "base\n");
    git(hookRepo, ["add", "-A"]);
    git(hookRepo, ["commit", "-q", "--no-verify", "-m", "base, 4.4 done"]);
    git(hookRepo, ["branch", "stale"]);

    // main corrects the story downwards. The branch never touches this file,
    // which is what makes the catch-up merge clean.
    writeFileSync(path.join(hookRepo, DOC2), doc("ready"));
    git(hookRepo, ["add", "-A"]);
    git(hookRepo, ["commit", "-q", "--no-verify", "-m", "main: 4.4 was never done"]);

    git(hookRepo, ["switch", "-q", "stale"]);
    writeFileSync(path.join(hookRepo, "other.txt"), "branch work\n");
    git(hookRepo, ["add", "-A"]);
    git(hookRepo, ["commit", "-q", "--no-verify", "-m", "stale: unrelated work"]);

    // The real invocation: git runs this with cwd at the worktree root.
    // The sentinel is not decoration. Without it this test asserts only that the
    // merge succeeded, which is also what happens when the hook never runs at
    // all: if `core.hooksPath` is set, git ignores .git/hooks entirely, the hook
    // written here is installed nowhere git looks, the merge sails through and
    // every assertion below passes while proving nothing. This repo has met that
    // exact configuration before, which is why .githooks/pre-commit:5 records
    // that core.hooksPath "is an approach this repo's worktree config silently
    // defeats". So the test asserts the guard was CONSULTED, not merely that the
    // merge worked.
    const hook = path.join(hookRepo, ".git", "hooks", "pre-merge-commit");
    writeFileSync(
      hook,
      `#!/bin/sh\ntouch "$(git rev-parse --git-dir)/HOOK_RAN"\nexec "${process.execPath}" "${GUARD}"\n`,
      { mode: 0o755 },
    );
  });

  afterAll(() => {
    if (hookRoot) rmSync(hookRoot, { recursive: true, force: true });
  });

  it("lets a clean catch-up merge through the hook in one command", () => {
    let code = 0;
    let output = "";
    try {
      output = execFileSync("git", ["merge", "--no-edit", "main"], {
        cwd: hookRepo,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      code = e.status ?? 1;
      output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }

    expect(output).not.toContain("going backwards");
    expect(code).toBe(0);

    // The guard was actually consulted. Without this the test cannot tell a
    // passing guard from an uninstalled hook.
    expect(existsSync(path.join(hookRepo, ".git", "HOOK_RAN"))).toBe(true);

    // And it really merged, rather than stopping somewhere quiet.
    expect(git(hookRepo, ["rev-list", "--count", "HEAD..main"])).toBe("0");
    expect(git(hookRepo, ["rev-list", "--count", "--merges", "HEAD~1..HEAD"])).toBe("1");
  });
});
