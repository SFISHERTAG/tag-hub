/**
 * Refuses a commit that stages a credential.
 *
 * Scans the staged content only, never history: a check that fails on what is
 * already committed is a check that fails on the first run and gets disabled.
 * Existing exposure is a rotation problem, not a pre-commit problem.
 *
 * The patterns below are deliberately narrow. A secret scanner earns its place
 * by being believed, and one that flags a random base64 blob or a long test
 * fixture teaches everyone to pass TAG_ALLOW_SECRET=1 reflexively, at which
 * point it protects nothing. Each pattern here is a literal marker that does
 * not occur by accident — a PEM header, a provider's own key prefix — rather
 * than an entropy heuristic.
 *
 * The .env rule is separate and structural: any .env file is refused except
 * the .example templates, which exist precisely so the real ones never need
 * to be tracked.
 *
 * Escape hatch is typed, not remembered: TAG_ALLOW_SECRET=1 git commit ...
 */
import { execSync } from "node:child_process";

const PATTERNS = [
  { name: "PEM private key", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { name: "Google service account key", re: /"type"\s*:\s*"service_account"/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: "GitHub token", re: /\b(?:ghp|gho|ghs|ghu)_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{22,}/ },
  { name: "Stripe live key", re: /\bsk_live_[0-9A-Za-z]{16,}/ },
  { name: "Private key in a JSON blob", re: /"private_key"\s*:\s*"-----BEGIN/ },
];

/** Templates exist so the real file never has to be tracked. */
const ENV_ALLOWED = /(^|\/)\.env\.(example|template|sample)$/;
const ENV_FILE = /(^|\/)\.env(\.|$)/;

function git(args) {
  return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
}

/*
 * The set of files this check looks at.
 *
 * Locally that is the index, because the check runs from pre-commit and the
 * index is what is about to become a commit. In CI there is no index, so
 * reading it would return nothing and the check would pass without having
 * looked at anything, a green that means "did not run". TAG_DIFF_BASE makes
 * the range explicit instead: CI sets it to the PR's base ref and the check
 * scans everything the PR adds.
 */
function stagedFiles() {
  const base = process.env.TAG_DIFF_BASE;
  if (base) {
    return git(`diff --name-only --diff-filter=ACM ${base}...HEAD`).split("\n").filter(Boolean);
  }
  return git("diff --cached --name-only --diff-filter=ACM").split("\n").filter(Boolean);
}

function main() {
  if (process.env.TAG_ALLOW_SECRET === "1") {
    console.log("[secret-scan] TAG_ALLOW_SECRET=1 — allowing staged credentials.");
    return;
  }

  const findings = [];

  for (const file of stagedFiles()) {
    if (ENV_FILE.test(file) && !ENV_ALLOWED.test(file)) {
      findings.push({ file, what: "a tracked .env file" });
      continue;
    }

    let content;
    try {
      content = git(`show :${JSON.stringify(file)}`);
    } catch {
      continue; // unreadable or binary-ish; nothing to match against
    }
    // A binary blob cannot contain these markers meaningfully, and decoding it
    // as text produces noise rather than findings.
    if (content.includes("\0")) continue;

    for (const { name, re } of PATTERNS) {
      if (re.test(content)) findings.push({ file, what: name });
    }
  }

  if (findings.length === 0) return;

  console.error("\n[secret-scan] Refusing to commit — staged content looks like a credential.\n");
  for (const { file, what } of findings) console.error(`  ${file}\n      ${what}`);
  console.error(`
Unstage it and keep the value in a secret manager or an untracked .env.

A credential is exposed from the moment it is committed to a pushed branch,
not from the moment it is used, so a key that lands here needs rotating even
if it is removed in the next commit.

If this is a fixture or a documented example and not a live credential:

  TAG_ALLOW_SECRET=1 git commit ...
`);
  process.exit(1);
}

main();
