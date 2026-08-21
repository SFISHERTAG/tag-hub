/**
 * Installs the tracked hooks in .githooks/ into the repo's real hook directory.
 *
 * Why a copy step rather than `core.hooksPath = .githooks`, which would need
 * no install at all: this repo has `extensions.worktreeConfig` enabled, and
 * every agent worktree carries a `config.worktree` pinning
 *
 *   core.hooksPath = <repo>/.git/hooks
 *
 * Per-worktree config beats repo config, so a repo-level hooksPath governs the
 * main checkout and is silently ignored by every worktree — hooks that look
 * installed and never run. `.git/hooks` is the one directory every worktree
 * already agrees on, and it lives in the common git dir, so installing there
 * once covers every worktree and the main checkout together.
 *
 * The cost of `.git/hooks` is that it is not version-controlled and a fresh
 * clone has none of it. That is what the `prepare` script in package.json is
 * for: npm runs it after every `npm install`, so the hooks arrive with the
 * dependencies. The logic itself stays tracked in scripts/, where it can be
 * reviewed; only the shims are copied.
 */
import { execSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const MARKER = "tag-agent-hooks v1";

function commonGitDir() {
  const top = execSync("git rev-parse --show-toplevel").toString().trim();
  const common = execSync("git rev-parse --git-common-dir").toString().trim();
  return resolve(top, common);
}

function main() {
  const repoRoot = resolve(commonGitDir(), "..");
  const source = join(repoRoot, ".githooks");
  const dest = join(commonGitDir(), "hooks");

  if (!existsSync(source)) {
    console.log("[hooks] no .githooks/ directory — nothing to install.");
    return;
  }
  mkdirSync(dest, { recursive: true });

  const installed = [];
  const skipped = [];

  for (const name of readdirSync(source)) {
    const from = join(source, name);
    const to = join(dest, name);

    // Never clobber a hook this script did not write. A hook someone added by
    // hand is theirs, and silently replacing it is the kind of thing that
    // makes tooling untrustworthy.
    if (existsSync(to)) {
      const current = readFileSync(to, "utf8");
      if (!current.includes(MARKER)) {
        skipped.push(name);
        continue;
      }
    }

    copyFileSync(from, to);
    chmodSync(to, 0o755);
    installed.push(name);
  }

  if (installed.length > 0) console.log(`[hooks] installed: ${installed.join(", ")}`);

  if (skipped.length > 0) {
    console.warn(
      `[hooks] NOT installed, because a hook already there was not written by this script: ` +
        `${skipped.join(", ")}\n` +
        `        Inspect ${dest}, then delete the file and re-run to take it over.`,
    );
  }
}

main();
