import { describe, expect, it } from "vitest";
import { planMigrations } from "../scripts/lib/migration-plan.mjs";

/**
 * Story 14.2. The runner's decision, separated from the applying.
 *
 * 15.0 declined to build a runner and gave the reason: no staging environment,
 * migrations hand-applied straight at production, and a runner that guesses
 * wrong is worse than a human with a trustworthy list. 14.2 earns the runner by
 * supplying the environment that was missing — so the decision has to be
 * provable without a database, and the refusals matter more than the applies.
 */

const f = (name: string, checksum: string) => ({ filename: name, checksum });
const r = (name: string, checksum: string | null) => ({ filename: name, checksum });

describe("planMigrations", () => {
  it("applies nothing when the ledger is current", () => {
    const p = planMigrations([f("001_a.sql", "aa")], [r("001_a.sql", "aa")], { local: true });
    expect(p.pending).toEqual([]);
    expect(p.refusal).toBeNull();
  });

  it("plans the unapplied ones in filename order", () => {
    const p = planMigrations(
      [f("003_c.sql", "cc"), f("001_a.sql", "aa"), f("002_b.sql", "bb")],
      [r("001_a.sql", "aa")],
      { local: true },
    );
    expect(p.pending.map((m) => m.filename)).toEqual(["002_b.sql", "003_c.sql"]);
  });

  it("treats an unverified ledger row as applied, not as pending", () => {
    // 011 backfills 001-010 with a NULL checksum. Re-applying 003 against a
    // database that already has it is not idempotent in practice — it is how
    // you drop a table you meant to keep.
    const p = planMigrations([f("003_c.sql", "cc")], [r("003_c.sql", null)], { local: true });
    expect(p.pending).toEqual([]);
  });

  /**
   * The refusals. Each of these is a way a runner does damage, which is what
   * 15.0 was worried about.
   */
  it("refuses to run against a non-local database", () => {
    const p = planMigrations([f("001_a.sql", "aa")], [], { local: false });
    expect(p.refusal).toMatch(/not local/i);
    expect(p.pending).toEqual([]);
  });

  it("refuses when a migration was edited after being applied", () => {
    const p = planMigrations([f("001_a.sql", "NEW")], [r("001_a.sql", "old")], { local: true });
    expect(p.refusal).toMatch(/edited/i);
    expect(p.pending).toEqual([]);
  });

  it("refuses when the ledger names a file that is gone", () => {
    const p = planMigrations([], [r("004_gone.sql", "dd")], { local: true });
    expect(p.refusal).toMatch(/no longer on disk/i);
  });

  it("refuses a gap: an earlier migration unapplied while a later one is applied", () => {
    // Out-of-order application is how 006 broke: it assumed 003 had run.
    const p = planMigrations(
      [f("001_a.sql", "aa"), f("002_b.sql", "bb")],
      [r("002_b.sql", "bb")],
      { local: true },
    );
    expect(p.refusal).toMatch(/out of order|gap/i);
  });

  it("allows the force flag to override the non-local refusal only", () => {
    const p = planMigrations([f("001_a.sql", "aa")], [], { local: false, force: true });
    expect(p.refusal).toBeNull();
    expect(p.pending.map((m) => m.filename)).toEqual(["001_a.sql"]);
  });

  it("does not let force override an edited migration", () => {
    // Force is for "I know this is production". It is not for "apply anyway
    // over a file that changed underneath the ledger".
    const p = planMigrations([f("001_a.sql", "NEW")], [r("001_a.sql", "old")], {
      local: false,
      force: true,
    });
    expect(p.refusal).toMatch(/edited/i);
  });
});
