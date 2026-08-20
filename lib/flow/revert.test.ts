import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: revertChange() correctly restores the field to its old value in the
 * actual table, but re-logged the ORIGINAL audit entry's changes object
 * verbatim for the revert's own log entry — claiming the revert moved the
 * field old -> new (the original direction) when it actually moved it
 * new -> old (reverting it). Fixed to invert the recorded direction.
 */

const clientQuery = vi.fn();
const fakeClient = { query: clientQuery, release: vi.fn() };
const connect = vi.fn(async () => fakeClient);

vi.mock("@/lib/postgres", () => ({
  pool: { connect: () => connect() },
}));

const { revertChange } = await import("./db");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revertChange audit direction", () => {
  it("logs the revert's own entry with old/new inverted from the original change", async () => {
    const originalChanges = { content: { old: "Old script text", new: "New script text" } };

    clientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: "audit1",
            org_id: "org1",
            table_name: "flow_scripts",
            record_id: "script1",
            changes: JSON.stringify(originalChanges),
          },
        ],
      }) // SELECT flow_audit_log
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE flow_scripts (one row restored)
      .mockResolvedValueOnce(undefined) // INSERT flow_audit_log (the revert's own entry)
      .mockResolvedValueOnce(undefined); // COMMIT

    await revertChange("audit1", "manager@tag.test");

    // Call 3 (0-indexed 2) is the UPDATE that actually restores the field —
    // must use the original "old" value.
    const updateCall = clientQuery.mock.calls[2];
    expect(updateCall[0]).toContain("UPDATE flow_scripts");
    expect(updateCall[1]).toEqual(["script1", "Old script text"]);

    // Call 4 is the new audit_log row for the revert itself — its recorded
    // "old" must be what the field was BEFORE this revert (the original
    // "new"), and its "new" must be what the revert set it to (the original
    // "old"). The naive bug logged `originalChanges` unchanged here.
    const logCall = clientQuery.mock.calls[3];
    expect(logCall[0]).toContain("INSERT INTO flow_audit_log");
    const loggedChanges = JSON.parse(logCall[1][4]);
    expect(loggedChanges).toEqual({
      content: { old: "New script text", new: "Old script text" },
    });
    expect(loggedChanges).not.toEqual(originalChanges);
  });

  it("reports failure when the record it would restore no longer exists", async () => {
    // A hard-deleted script updates zero rows. This used to commit anyway,
    // write a revert entry into the audit log, and return true — so the UI
    // said "reverted" while nothing had been restored and the log claimed a
    // change that never happened.
    clientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: "audit1",
            org_id: "org1",
            table_name: "flow_scripts",
            record_id: "deleted-script",
            changes: JSON.stringify({ content: { old: "Old", new: "New" } }),
          },
        ],
      }) // SELECT flow_audit_log
      .mockResolvedValueOnce({ rowCount: 0 }) // UPDATE matched nothing
      .mockResolvedValueOnce(undefined); // ROLLBACK

    await expect(revertChange("audit1", "manager@tag.test")).resolves.toBe(false);

    const logged = clientQuery.mock.calls.some((call) =>
      String(call[0]).includes("INSERT INTO flow_audit_log"),
    );
    expect(logged).toBe(false);

    const rolledBack = clientQuery.mock.calls.some((call) => String(call[0]) === "ROLLBACK");
    expect(rolledBack).toBe(true);
  });
});
