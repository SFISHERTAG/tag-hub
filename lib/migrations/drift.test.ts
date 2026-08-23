import { describe, expect, it } from "vitest";
import { compareMigrations, type LedgerRow, type DiskFile } from "./drift";

/**
 * Story 15.0. The comparison is pure so it can be proved without a database;
 * the script around it does the I/O.
 *
 * The case that matters most is `edited`: a migration applied and then changed
 * afterwards. That is what nothing could see before, and it is the shape of the
 * 006 incident.
 */

const file = (name: string, checksum: string): DiskFile => ({ filename: name, checksum });
const row = (name: string, checksum: string | null): LedgerRow => ({ filename: name, checksum });

describe("compareMigrations", () => {
  it("reports nothing when disk and ledger agree", () => {
    const result = compareMigrations([file("001_a.sql", "aaa")], [row("001_a.sql", "aaa")]);
    expect(result.unapplied).toEqual([]);
    expect(result.edited).toEqual([]);
    expect(result.missingFile).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("flags a file on disk with no ledger row as unapplied", () => {
    const result = compareMigrations([file("012_new.sql", "bbb")], []);
    expect(result.unapplied).toEqual(["012_new.sql"]);
    expect(result.ok).toBe(false);
  });

  it("flags a checksum mismatch as edited-after-apply", () => {
    const result = compareMigrations([file("006_x.sql", "new")], [row("006_x.sql", "old")]);
    expect(result.edited).toEqual([{ filename: "006_x.sql", ledger: "old", disk: "new" }]);
    expect(result.ok).toBe(false);
  });

  it("flags a ledger row whose file has been deleted", () => {
    const result = compareMigrations([], [row("004_gone.sql", "ccc")]);
    expect(result.missingFile).toEqual(["004_gone.sql"]);
    expect(result.ok).toBe(false);
  });

  /**
   * The backfill records history it cannot verify, so those rows carry a NULL
   * checksum. Treating NULL as agreement would let the ledger claim more than
   * it knows; treating it as a mismatch would fail on day one for ten files
   * that are genuinely applied. It is its own category.
   */
  it("reports a NULL ledger checksum as unverified, not as agreement or drift", () => {
    const result = compareMigrations([file("003_x.sql", "ddd")], [row("003_x.sql", null)]);
    expect(result.unverified).toEqual(["003_x.sql"]);
    expect(result.edited).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("does not let an unverified row hide a genuine problem elsewhere", () => {
    const result = compareMigrations(
      [file("003_x.sql", "ddd"), file("012_new.sql", "eee")],
      [row("003_x.sql", null)],
    );
    expect(result.unverified).toEqual(["003_x.sql"]);
    expect(result.unapplied).toEqual(["012_new.sql"]);
    expect(result.ok).toBe(false);
  });

  it("orders findings by filename so output is stable between runs", () => {
    const result = compareMigrations(
      [file("013_c.sql", "1"), file("012_b.sql", "2")],
      [],
    );
    expect(result.unapplied).toEqual(["012_b.sql", "013_c.sql"]);
  });
});
