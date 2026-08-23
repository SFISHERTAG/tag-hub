#!/usr/bin/env node
/**
 * Applies pending migrations to a LOCAL database.
 *
 *   npm run migrate:local            apply what is pending
 *   npm run migrate:local -- --dry   plan only, touch nothing
 *
 * Story 14.2. Story 15.0 declined to build this, and the reason it gave was
 * correct: no staging environment, migrations hand-applied straight at
 * production, and a runner that guesses wrong is worse than a human with a
 * trustworthy list. 14.2 supplies the missing environment, which is the only
 * thing that changed. Production is still applied by hand, and this refuses a
 * non-local target unless the operator says --force in as many words.
 *
 * Every decision lives in scripts/lib/migration-plan.mjs so the refusals are
 * provable without a database. This file does I/O and nothing else.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { planMigrations } from "./lib/migration-plan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL_DIR = join(HERE, "..", "functions", "sql");
const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** Local means loopback. Anything else is somebody's real data. */
function isLocal(host) {
  return ["localhost", "127.0.0.1", "::1", ""].includes((host ?? "").trim());
}

async function diskMigrations() {
  const names = (await readdir(SQL_DIR)).filter((n) => n.endsWith(".sql")).sort();
  return Promise.all(
    names.map(async (filename) => {
      const sql = await readFile(join(SQL_DIR, filename), "utf8");
      return { filename, checksum: sha256(sql), sql };
    }),
  );
}

const { Pool } = (await import("pg")).default;
const host = process.env.DB_HOST ?? "localhost";

/*
 * Migrations connect as a different role than the app, and finding that out is
 * most of what this story was worth.
 *
 * Running as DB_USER locally fails with "permission denied for schema public":
 * tag_app_user holds SELECT/INSERT/UPDATE/DELETE and no DDL rights, which is
 * correct for an application user and useless for a migration. Production has
 * the same shape — migration 010 is on disk and unapplied because CREATE INDEX
 * on course_progress needs the table's owner and tag_app_user is not it.
 *
 * So DB_MIGRATION_USER is the role that owns the schema, falling back to DB_USER
 * for anyone whose setup does not separate them. The app never uses it.
 */
const migrationUser = process.env.DB_MIGRATION_USER || process.env.DB_USER;
const migrationPassword = process.env.DB_MIGRATION_PASSWORD ?? process.env.DB_PASSWORD;

const pool = new Pool({
  host,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "tag_automation",
  user: migrationUser,
  password: migrationPassword,
  max: 1,
});

/*
 * The ledger has to exist before the first migration can be recorded in it, and
 * the ledger is itself migration 011. On a database that predates 011 — which is
 * every fresh local one — recording 001 fails with 'relation "schema_migrations"
 * does not exist' and the run dies on its first step.
 *
 * So the runner creates it up front. Idempotent, and deliberately identical to
 * 011's definition: if the two ever disagree, a local database and a production
 * one end up with different ledgers, which is worse than having none. 011 stays
 * as the migration of record for a database applied by hand.
 */
async function ensureLedger() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    TEXT
    )
  `);
}

async function ledgerRows() {
  // The ledger is itself a migration (011), so on a database that predates it
  // there is no table to read. An empty ledger is the correct answer there.
  try {
    const { rows } = await pool.query(`SELECT filename, checksum FROM schema_migrations`);
    return rows;
  } catch {
    return [];
  }
}

await ensureLedger();
const disk = await diskMigrations();
const ledger = await ledgerRows();
const plan = planMigrations(disk, ledger, { local: isLocal(host), force: FORCE });

console.log(`target   ${host}/${process.env.DB_NAME ?? "tag_automation"}${isLocal(host) ? " (local)" : " (NOT LOCAL)"}`);
console.log(`as       ${migrationUser}${process.env.DB_MIGRATION_USER ? "" : " (DB_USER; set DB_MIGRATION_USER if it lacks DDL rights)"}`);
console.log(`on disk  ${disk.length}`);
console.log(`applied  ${ledger.length}`);

if (plan.refusal) {
  console.error(`\nRefusing to run: ${plan.refusal}\n`);
  await pool.end();
  process.exit(1);
}

if (plan.pending.length === 0) {
  console.log("\nNothing pending.");
  await pool.end();
  process.exit(0);
}

console.log(`\npending  ${plan.pending.length}`);
for (const m of plan.pending) console.log(`  ${m.filename}`);

if (DRY) {
  console.log("\nDry run. Nothing applied.");
  await pool.end();
  process.exit(0);
}

for (const m of plan.pending) {
  process.stdout.write(`\napplying ${m.filename} ... `);
  const client = await pool.connect();
  try {
    // One transaction per migration, and the ledger row is written inside it.
    // A file that half-applies and still records as done is the worst outcome
    // available here — worse than not running at all, because the next run
    // skips it.
    await client.query("BEGIN");
    await client.query(m.sql);
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)
       ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`,
      [m.filename, m.checksum],
    );
    await client.query("COMMIT");
    console.log("ok");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.log("FAILED");
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    console.error(`Rolled back. ${m.filename} is not recorded as applied.`);
    client.release();
    await pool.end();
    process.exit(1);
  } finally {
    client.release();
  }
}

console.log(`\nApplied ${plan.pending.length}. Run 'npm run check:migrations' to confirm.`);
await pool.end();
