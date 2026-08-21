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

// Version-agnostic on purpose. The check below only asks "did this script
// write the hook that is already there", and pinning the marker to one
// version answers "no" the moment the hook is revised — which would make
// every install after a bump skip with a warning about a hand-written hook
// that does not exist.
const MARKER = "tag-agent-hooks";

function commonGitDir() {
  const top = execSync("git rev-parse --show-toplevel").toString().trim();
  const common = execSync("git rev-parse --git-common-dir").toString().trim();
  return resolve(top, common);
}

function main() {
  // Source from the working tree this ran in, not from the main checkout.
  // `resolve(commonGitDir(), "..")` is the main checkout's root, and that
  // checkout is frequently parked on some other branch — one that may not
  // have .githooks/ at all. When that happened, this script reported
  // "nothing to install" and exited 0 from a worktree whose .githooks/ was
  // sitting right there, so the installed hooks silently stayed at whatever
  // version they were. The destination below is still the common hook dir,
  // shared by every worktree, which is the part that should not be per-tree.
  const source = join(execSync("git rev-parse --show-toplevel").toString().trim(), ".githooks");
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

  warnIfHooksPathRedirected(dest);
}

/**
 * Copying into .git/hooks only runs the hooks if git is still looking there.
 *
 * `core.hooksPath` overrides that directory outright, and nothing above reads
 * it — so with it set, every file above is copied somewhere git never opens
 * and this script still reports success. That is reachable, not theoretical:
 * it happened here while comparing this approach against a hooksPath-based
 * one, and the hooks silently stopped running until the value was unset.
 *
 * Warn rather than fail. An unrelated pre-existing hooksPath is the user's
 * setting to keep, and the install genuinely did copy the files; what is not
 * acceptable is letting it look like the hooks are live when they are not.
 */
function warnIfHooksPathRedirected(dest) {
  let configured;
  try {
    configured = execSync("git config --get core.hooksPath", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return; // Unset, so git uses .git/hooks and the copy above is what runs.
  }
  if (!configured) return;

  const effective = resolve(commonGitDir(), "..", configured);
  if (effective === resolve(dest)) return;

  console.warn(
    `\n[hooks] WARNING: hooks were installed to\n` +
      `          ${dest}\n` +
      `        but core.hooksPath redirects git to\n` +
      `          ${configured}\n` +
      `        so nothing installed above will run. Either unset it:\n\n` +
      `          git config --unset core.hooksPath\n\n` +
      `        or install to that path instead. Note core.hooksPath can also be\n` +
      `        set per-worktree in .git/worktrees/<name>/config.worktree, which\n` +
      `        beats the repo-level value.\n`,
  );
}

main();
