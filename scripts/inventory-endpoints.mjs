#!/usr/bin/env node
// Story 11.5 — the endpoint inventory a feature story runs before writing a
// component.
//
// An Angular SPA cannot call a Server Action and cannot import `lib/`. So every
// data path a screen needs must exist under app/api/** first, and the list of
// what does not yet exist IS the endpoint spec for that story.
//
// This exists as a script rather than a number in a doc because the number
// moves. docs/epics.md was planned on "39 Server Actions across 21 files, 24 of
// 25 pages"; both had grown before the epic's second story started. A figure
// written down once is stale by the time someone acts on it.
//
// Usage:
//   node scripts/inventory-endpoints.mjs                 whole app
//   node scripts/inventory-endpoints.mjs --area=l        one feature area
//   node scripts/inventory-endpoints.mjs --json          machine-readable
//
// All decisions live in scripts/lib/endpoint-inventory.mjs, which is pure and
// tested. This file only walks, prints, and reports the commit it measured at
// so a pasted result can be dated.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { summarize, featureAreaOf, possiblyCovered } from "./lib/endpoint-inventory.mjs";

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();

function currentCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: repoRoot }).toString().trim();
  } catch {
    return "unknown";
  }
}

/**
 * Tracked files under app/ and lib/. `git ls-files` rather than a directory walk,
 * so an untracked scratch file or a stale build artifact cannot inflate a count
 * that an estimate is built on.
 */
function loadAppFiles() {
  // lib/ is listed as well as app/, and that is not tidiness. `"use server"`
  // marks a file, not a directory, and lib/auth/impersonation-actions.ts held
  // two Server Actions that this inventory could not see — so it reported zero
  // remaining while the metric it exists to track was not zero.
  const listed = execSync('git ls-files "app/*.ts" "app/*.tsx" "lib/*.ts"', { cwd: repoRoot })
    .toString()
    .split("\n")
    .filter(Boolean);

  return listed.map((path) => ({
    path,
    source: readFileSync(join(repoRoot, path), "utf8"),
  }));
}

function parseArgs(argv) {
  const areaArg = argv.find((a) => a.startsWith("--area="));
  return {
    area: areaArg ? areaArg.slice("--area=".length) : undefined,
    json: argv.includes("--json"),
  };
}

const { area, json } = parseArgs(process.argv.slice(2));
const files = loadAppFiles();
const commit = currentCommit();

if (area && !files.some((f) => featureAreaOf(f.path) === area)) {
  const areas = [...new Set(files.map((f) => featureAreaOf(f.path)).filter(Boolean))].sort();
  console.error(`No feature area "${area}". Known areas:\n  ${areas.join("\n  ")}`);
  process.exit(1);
}

const result = summarize(files, area ? { area } : {});

if (json) {
  console.log(JSON.stringify({ commit, area: area ?? "all", ...result }, null, 2));
  process.exit(0);
}

const scope = area ? `area "${area}"` : "whole app";
console.log(`Endpoint inventory — ${scope}, measured at ${commit}\n`);

console.log(`  Server Actions            ${result.actionCount} across ${result.actionFileCount} files`);
console.log(`  Existing app/api routes   ${result.routeCount}`);
console.log(`  Pages importing lib/      ${result.pagesImportingLib} of ${result.pageCount}`);

// The progress number for Epic 10. Screens can look ported while their actions
// live on, and that state is indistinguishable from done at a glance.
console.log(`\n  Remaining to migrate: ${result.actionFileCount} action files, ${result.pagesImportingLib} pages`);

const areas = Object.keys(result.byArea).sort();
if (areas.length > 0) {
  console.log("\nBy area:\n");
  for (const a of areas) {
    const entry = result.byArea[a];
    if (entry.actions.length === 0 && entry.pagesImportingLib.length === 0 && entry.routes.length === 0) {
      continue;
    }
    console.log(`  ${a}`);
    if (entry.actions.length > 0) {
      console.log(`    actions needing an endpoint (${entry.actions.length}):`);
      for (const action of entry.actions) {
        const hint = possiblyCovered(action, result.routes) ? "  (possibly covered — verify)" : "";
        console.log(`      ${action}${hint}`);
      }
    }
    if (entry.pagesImportingLib.length > 0) {
      console.log(`    pages importing lib/ (${entry.pagesImportingLib.length}):`);
      for (const p of entry.pagesImportingLib) console.log(`      ${p}`);
    }
    if (entry.routes.length > 0) {
      console.log(`    existing routes (${entry.routes.length})`);
    }
    console.log("");
  }
}

console.log(
  "Note: \"possibly covered\" is a name match against existing routes, not a verdict.\n" +
    "An endpoint sharing a noun with an action may still not do what the action does.",
);
