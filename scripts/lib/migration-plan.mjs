/**
 * What a migration runner should do, decided without touching a database.
 *
 * Story 14.2. Story 15.0 deliberately did not build a runner and the reasoning
 * still holds: there is no staging environment, these files are hand-applied
 * straight at production, and a runner that guesses wrong is worse than a human
 * with a trustworthy list. What 14.2 changes is only that a local database now
 * exists to be wrong against. It does not make production safe to automate, so
 * this refuses a non-local target unless told, in words, that the operator
 * knows.
 *
 * The refusals are the point of this module. Applying is the easy half.
 */

/** True when the checksum recorded at apply time no longer matches the file. */
function edited(diskFile, row) {
  return row.checksum !== null && row.checksum !== diskFile.checksum;
}

/**
 * @param {{filename: string, checksum: string}[]} disk
 * @param {{filename: string, checksum: string|null}[]} ledger
 * @param {{local: boolean, force?: boolean}} target
 */
export function planMigrations(disk, ledger, target) {
  const byName = new Map(ledger.map((r) => [r.filename, r]));
  const ordered = [...disk].sort((a, b) => a.filename.localeCompare(b.filename));

  const refuse = (reason) => ({ pending: [], refusal: reason });

  /*
   * Checked before the local/force question on purpose. An edited migration is
   * wrong everywhere: the ledger says one thing ran and the file now says
   * another, so nobody knows what the database contains. `--force` means "yes,
   * this is production and I mean it" — it is not a way to apply on top of
   * drift, and letting it cover both would make the dangerous case reachable by
   * the flag people learn to type first.
   */
  for (const file of ordered) {
    const row = byName.get(file.filename);
    if (row && edited(file, row)) {
      return refuse(
        `${file.filename} was edited after it was applied. The ledger's checksum ` +
          `and the file disagree, so what the database actually contains is unknown. ` +
          `Resolve that before applying anything.`,
      );
    }
  }

  const onDisk = new Set(ordered.map((f) => f.filename));
  for (const row of ledger) {
    if (!onDisk.has(row.filename)) {
      return refuse(
        `${row.filename} is in the ledger but no longer on disk. Either it was ` +
          `renamed without updating the ledger, or this tree is missing a migration ` +
          `the database has already run.`,
      );
    }
  }

  /*
   * A gap means an earlier migration is unapplied while a later one is not.
   * That is how 006 broke: it assumed 003 had already created a table, and on a
   * clean sequential deploy it had not. Applying into a gap runs files against a
   * schema shape their author never saw.
   */
  const applied = ordered.map((f) => byName.has(f.filename));
  const lastApplied = applied.lastIndexOf(true);
  const firstMissing = applied.indexOf(false);
  if (firstMissing !== -1 && lastApplied > firstMissing) {
    return refuse(
      `${ordered[firstMissing].filename} is unapplied but ` +
        `${ordered[lastApplied].filename} has already run. Migrations are ordered, ` +
        `and applying into that gap runs a file against a schema its author never ` +
        `saw — which is exactly how 006 failed.`,
    );
  }

  if (!target.local && !target.force) {
    return refuse(
      `the target is not local. This runner exists so migrations can be proven ` +
        `against a local database; production is still applied by a human who has ` +
        `read the file. Pass --force only if you are that human.`,
    );
  }

  return {
    pending: ordered.filter((f) => !byName.has(f.filename)),
    refusal: null,
  };
}
