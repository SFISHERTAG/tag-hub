#!/usr/bin/env node
/**
 * Role list parity.
 *
 * The role list exists in three places, for three real reasons: the canonical
 * server definition, its Angular mirror (a browser bundle can't import a
 * `server-only` module's neighbours across the workspace boundary), and a
 * standalone admin CLI that runs without the TypeScript build. Three copies is
 * a drift bug waiting to happen, so this script fails the commit the moment any
 * of them disagrees.
 *
 * This is the mechanical half of CLAUDE.md's permission contract. The other
 * half — no inline role strings — lives in check-story-status.mjs.
 *
 * Run: node scripts/check-role-parity.mjs   (also: npm run check:role-parity)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Parse `export const ROLES = { KEY: "value", ... } as const`. */
function parseKeyedRoles(relPath) {
  const content = readFileSync(join(repoRoot, relPath), "utf8");
  const match = content.match(/export const ROLES = \{([\s\S]*?)\} as const/);
  if (!match) throw new Error(`${relPath}: could not find a keyed \`export const ROLES = {...} as const\``);
  const entries = [...match[1].matchAll(/([A-Z0-9_]+)\s*:\s*["']([a-z_]+)["']/g)].map((m) => [m[1], m[2]]);
  if (entries.length === 0) throw new Error(`${relPath}: parsed zero roles`);
  return entries;
}

/** Parse the plain `const ROLES = ["a", "b"]` array used by the standalone CLI. */
function parseArrayRoles(relPath) {
  const content = readFileSync(join(repoRoot, relPath), "utf8");
  const match = content.match(/const ROLES = \[([\s\S]*?)\]/);
  if (!match) throw new Error(`${relPath}: could not find \`const ROLES = [...]\``);
  const values = [...match[1].matchAll(/["']([a-z_]+)["']/g)].map((m) => m[1]);
  if (values.length === 0) throw new Error(`${relPath}: parsed zero roles`);
  return values;
}

const CANONICAL = "lib/auth/role-labels.ts";
const MIRROR = "web/src/app/core/models/role.model.ts";
const CLI = "scripts/create-user.mjs";

const issues = [];
let canonical;

try {
  canonical = parseKeyedRoles(CANONICAL);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}

// The Angular mirror must match key for key and value for value, in order.
try {
  const mirror = parseKeyedRoles(MIRROR);
  const fmt = (entries) => entries.map(([k, v]) => `${k}=${v}`).join(", ");
  if (fmt(canonical) !== fmt(mirror)) {
    issues.push(
      `${MIRROR} does not match ${CANONICAL}.\n` +
        `    canonical: ${fmt(canonical)}\n` +
        `    mirror:    ${fmt(mirror)}`
    );
  }
} catch (err) {
  issues.push(err.message);
}

// The CLI has no keys and its display order is a help-text choice, so compare
// membership rather than sequence — but membership must be exact both ways.
try {
  const cliRoles = new Set(parseArrayRoles(CLI));
  const canonicalValues = canonical.map(([, v]) => v);
  const missing = canonicalValues.filter((v) => !cliRoles.has(v));
  const extra = [...cliRoles].filter((v) => !canonicalValues.includes(v));
  if (missing.length > 0 || extra.length > 0) {
    issues.push(
      `${CLI} does not match ${CANONICAL}.` +
        (missing.length > 0 ? `\n    missing: ${missing.join(", ")}` : "") +
        (extra.length > 0 ? `\n    unknown: ${extra.join(", ")}` : "")
    );
  }
} catch (err) {
  issues.push(err.message);
}

if (issues.length > 0) {
  console.error("✗ Role list parity check failed:\n");
  for (const issue of issues) console.error(`  - ${issue}\n`);
  console.error("  Every copy of the role list must agree. Update the mismatched file.");
  process.exit(1);
}

console.log(`✓ Role parity: ${canonical.length} roles consistent across 3 definitions`);
