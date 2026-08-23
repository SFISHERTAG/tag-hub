/**
 * Comparing what is on disk against what the ledger says was applied.
 *
 * Story 15.0. Pure on purpose: the whole point is a trustworthy answer, and an
 * answer that needs a live database to prove is one nobody checks. The script
 * does the I/O and calls this.
 *
 * Deliberately read-only, in this story and by design. A runner that applies
 * what is missing is the obvious next step and is a separate decision with a
 * separate blast radius: there is no staging environment and these files are
 * hand-applied against production. The ledger makes the list trustworthy first.
 */

export type DiskFile = {
  filename: string;
  /** sha256 of the file's bytes, hex. */
  checksum: string;
};

export type LedgerRow = {
  filename: string;
  /** NULL for the rows backfilled by 011, which assert history nothing can verify. */
  checksum: string | null;
};

export type Edited = {
  filename: string;
  ledger: string;
  disk: string;
};

export type DriftReport = {
  /** On disk, no ledger row. Almost always: someone forgot to apply it. */
  unapplied: string[];
  /** Applied, then the file changed. The condition this exists to surface. */
  edited: Edited[];
  /** Ledger row with no file. Either deleted or renamed without a ledger update. */
  missingFile: string[];
  /** Applied, but the ledger holds no checksum to compare against. */
  unverified: string[];
  /** False if anything needs a human. `unverified` alone does not fail. */
  ok: boolean;
};

/**
 * `unverified` does not set `ok = false`, and that is a deliberate choice
 * rather than leniency. 011 backfills ten filenames with a NULL checksum
 * because it is asserting that files already ran, not discovering it. Failing
 * on those would make the check red on the day it ships, for ten migrations
 * that are genuinely applied — and a check that is red on arrival gets muted.
 * Counting them as agreement would be worse: the ledger would claim more than
 * it knows. So they are reported, loudly, in their own category.
 */
export function compareMigrations(
  disk: readonly DiskFile[],
  ledger: readonly LedgerRow[],
): DriftReport {
  const ledgerBy = new Map(ledger.map((r) => [r.filename, r]));
  const diskBy = new Map(disk.map((f) => [f.filename, f]));

  const unapplied: string[] = [];
  const edited: Edited[] = [];
  const unverified: string[] = [];

  for (const f of disk) {
    const row = ledgerBy.get(f.filename);
    if (!row) {
      unapplied.push(f.filename);
      continue;
    }
    if (row.checksum === null) {
      unverified.push(f.filename);
      continue;
    }
    if (row.checksum !== f.checksum) {
      edited.push({ filename: f.filename, ledger: row.checksum, disk: f.checksum });
    }
  }

  const missingFile = ledger
    .filter((r) => !diskBy.has(r.filename))
    .map((r) => r.filename);

  // Sorted so a diff between two runs is a real change, not map ordering.
  const byName = (a: string, b: string) => a.localeCompare(b);
  unapplied.sort(byName);
  unverified.sort(byName);
  missingFile.sort(byName);
  edited.sort((a, b) => byName(a.filename, b.filename));

  return {
    unapplied,
    edited,
    missingFile,
    unverified,
    ok: unapplied.length === 0 && edited.length === 0 && missingFile.length === 0,
  };
}
