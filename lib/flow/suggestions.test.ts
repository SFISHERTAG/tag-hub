import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Closers can't edit FLOW scripts directly — they submit a suggestion for a
 * sales manager to approve or reject. Approving must create a new script
 * version and log it like a direct edit; rejecting must not touch scripts
 * at all.
 */

const query = vi.fn();
/**
 * `resolveSuggestion` claims the suggestion inside a transaction now, so it
 * checks out a client rather than using the pool directly. Both surfaces
 * route to the same `query` spy, which keeps the call-order assertions below
 * meaningful — `clientQuery` calls are BEGIN/COMMIT and the statements
 * between them.
 */
const clientQuery = vi.fn();
vi.mock("@/lib/postgres", () => ({
  pool: {
    query: (...args: unknown[]) => query(...args),
    connect: async () => ({
      query: (...args: unknown[]) => clientQuery(...args),
      release: () => {},
    }),
  },
}));

const { createSuggestion, resolveSuggestion } = await import("./db");

beforeEach(() => {
  query.mockReset();
  clientQuery.mockReset();
  // BEGIN / COMMIT / ROLLBACK resolve to nothing in particular.
  clientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("createSuggestion", () => {
  it("inserts a pending suggestion tied to the card and submitter", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: "sug1",
          org_id: "org1",
          card_id: "card1",
          suggested_content: "New opener",
          status: "pending",
          suggested_by: "closer@tag.test",
        },
      ],
    });

    const result = await createSuggestion("card1", {
      org_id: "org1",
      suggested_content: "New opener",
      suggested_by: "closer@tag.test",
    });

    expect(result.status).toBe("pending");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO flow_script_suggestions"),
      ["org1", "card1", "New opener", null, null, null, "closer@tag.test"],
    );
  });
});

describe("resolveSuggestion", () => {
  const pendingSuggestion = {
    id: "sug1",
    org_id: "org1",
    card_id: "card1",
    suggested_content: "New opener",
    suggested_why: "Prospects were confused by the old one",
    suggested_notes: null,
    suggestion_note: "Lost 2 deals to this exact objection this week",
    status: "pending",
    suggested_by: "closer@tag.test",
  };

  /** Statements the transaction actually ran, BEGIN/COMMIT excluded. */
  function statements(): string[] {
    return clientQuery.mock.calls
      .map((call) => String(call[0]))
      .filter((sql) => !/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/.test(sql));
  }

  it("approve creates a new script version, logs it, and marks the suggestion resolved", async () => {
    clientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [pendingSuggestion], rowCount: 1 }) // claim
      .mockResolvedValueOnce({ rows: [{ id: "script-new", content: "New opener" }], rowCount: 1 }) // INSERT script
      .mockResolvedValueOnce({ rows: [{ id: "audit1" }], rowCount: 1 }) // audit log
      .mockResolvedValueOnce({
        rows: [{ id: "sug1", status: "approved", resulting_script_id: "script-new" }],
        rowCount: 1,
      }) // link script id
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await resolveSuggestion("sug1", "approve", "manager@tag.test", "Good catch");

    expect(result.status).toBe("approved");
    expect(result.resulting_script_id).toBe("script-new");

    // The claim is a conditional UPDATE, which is what makes it atomic.
    const claim = clientQuery.mock.calls[1];
    expect(String(claim[0])).toContain("status = 'pending'");

    // Script created with the suggested content, attributed to the closer.
    const scriptCall = clientQuery.mock.calls[2];
    expect(String(scriptCall[0])).toContain("INSERT INTO flow_scripts");
    expect(scriptCall[1]).toEqual(
      expect.arrayContaining(["card1", "New opener", "Prospects were confused by the old one"]),
    );

    // Audit entry records who approved it and why, tying back to the suggestion.
    const logCall = clientQuery.mock.calls[3];
    expect(String(logCall[0])).toContain("INSERT INTO flow_audit_log");
    expect(logCall[1]).toEqual(
      expect.arrayContaining(["org1", "flow_scripts", "script-new", "create"]),
    );
    expect(logCall[1][6]).toContain("Approved suggestion sug1 from closer@tag.test");
  });

  it("reject marks the suggestion resolved without touching flow_scripts", async () => {
    clientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "sug1", status: "rejected" }], rowCount: 1 }) // claim
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await resolveSuggestion("sug1", "reject", "manager@tag.test", "Not on-brand");

    expect(result.status).toBe("rejected");
    expect(statements().some((sql) => sql.includes("INSERT INTO flow_scripts"))).toBe(false);
  });

  it("loses the race rather than approving twice", async () => {
    // The claim UPDATE matches zero rows because another reviewer already
    // moved this suggestion off pending. Before it was atomic, both callers
    // read "pending", both created a script version on the same card, and the
    // second overwrote the first's reviewer attribution.
    clientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // claim lost
      .mockResolvedValueOnce(undefined); // ROLLBACK
    query.mockResolvedValueOnce({ rows: [{ ...pendingSuggestion, status: "approved" }] });

    await expect(resolveSuggestion("sug1", "approve", "manager@tag.test")).rejects.toThrow(
      /already approved/,
    );
    expect(statements().some((sql) => sql.includes("INSERT INTO flow_scripts"))).toBe(false);
  });

  it("throws when the suggestion doesn't exist", async () => {
    clientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // claim matched nothing
      .mockResolvedValueOnce(undefined); // ROLLBACK
    query.mockResolvedValueOnce({ rows: [] }); // getSuggestion: really gone

    await expect(resolveSuggestion("missing", "approve", "manager@tag.test")).rejects.toThrow(
      /not found/,
    );
  });
});
