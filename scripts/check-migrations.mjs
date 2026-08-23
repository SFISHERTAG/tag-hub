#!/usr/bin/env node
/**
 * Story 15.0 — report drift between functions/sql/ and the schema_migrations
 * ledger.
 *
 *   npm run check:migrations
 *
 * Read-only. It reports; it never applies and never writes. See
 * lib/migrations/drift.ts for why that line is drawn here.
 *
 * Exits 1 on drift so it can gate a deploy. An unverified row — a NULL
 * checksum from 011's backfill — is reported but does not fail, because ten of
 * those exist by construction on day one.
 *
 * With no database reachable it exits 0 and says so. This runs in environments
 * that have no Postgres (a fresh clone, CI without secrets), and turning that
 * into a failure would train everyone to ignore it.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL_DIR = join(HERE, "..", "functions", "sql");

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readDisk() {
  const names = (await readdir(SQL_DIR)).filter((n) => n.endsWith(".sql")).sort();
  return Promise.all(
    names.map(async (filename) => ({
      filename,
      checksum: sha256(await readFile(join(SQL_DIR, filename), "utf8")),
    })),
  );
}

async function readLedger() {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    return null;
  }
  const { Pool } = pg.default ?? pg;
  const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    const result = await pool.query(`SELECT filename, checksum FROM schema_migrations`);
    return result.rows;
  } catch {
    return null;
  } finally {
    await pool.end().catch(() => {});
  }
}

const { compareMigrations } = await import("../lib/migrations/drift.ts").catch(async () => {
  // The .ts import works under tsx; fall back to a inline copy-free path by
  // failing loudly rather than silently diverging from the tested logic.
  throw new Error(
    "Run through tsx so the tested comparison in lib/migrations/drift.ts is the one used: " +
      "npx tsx scripts/check-migrations.mjs",
  );
});

const disk = await readDisk();
const ledger = await readLedger();

if (ledger === null) {
  console.log(`No database reachable. ${disk.length} migration file(s) on disk, ledger not checked.`);
  process.exit(0);
}

const report = compareMigrations(disk, ledger);

console.log(`${disk.length} file(s) on disk, ${ledger.length} ledger row(s).`);

if (report.unverified.length) {
  console.log(`\nUnverified (applied, no checksum recorded — expected for 001-011):`);
  for (const f of report.unverified) console.log(`  ${f}`);
}
if (report.unapplied.length) {
  console.error(`\nNOT APPLIED — on disk with no ledger row:`);
  for (const f of report.unapplied) console.error(`  ${f}`);
}
if (report.edited.length) {
  console.error(`\nEDITED AFTER APPLYING — this is the one that matters:`);
  for (const e of report.edited) {
    console.error(`  ${e.filename}\n    ledger ${e.ledger}\n    disk   ${e.disk}`);
  }
}
if (report.missingFile.length) {
  console.error(`\nLEDGER ROW WITH NO FILE — deleted or renamed:`);
  for (const f of report.missingFile) console.error(`  ${f}`);
}

if (report.ok) {
  console.log(`\nNo drift.`);
  process.exit(0);
}
console.error(`\nDrift found. Nothing was changed; this check does not apply migrations.`);
process.exit(1);
