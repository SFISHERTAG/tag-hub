import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Closers can't edit FLOW scripts directly — they submit a suggestion for a
 * sales manager to approve or reject. Approving must create a new script
 * version and log it like a direct edit; rejecting must not touch scripts
 * at all.
 */

const query = vi.fn();
vi.mock("@/lib/postgres", () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
}));

const { createSuggestion, resolveSuggestion } = await import("./db");

beforeEach(() => {
  query.mockReset();
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

  it("approve creates a new script version, logs it, and marks the suggestion resolved", async () => {
    query
      .mockResolvedValueOnce({ rows: [pendingSuggestion] }) // getSuggestion
      .mockResolvedValueOnce({ rows: [{ id: "script-new", content: "New opener" }] }) // createScript
      .mockResolvedValueOnce({ rows: [{ id: "audit1" }] }) // logChange
      .mockResolvedValueOnce({
        rows: [{ id: "sug1", status: "approved", resulting_script_id: "script-new" }],
      }); // UPDATE suggestion

    const result = await resolveSuggestion("sug1", "approve", "manager@tag.test", "Good catch");

    expect(result.status).toBe("approved");
    expect(result.resulting_script_id).toBe("script-new");

    // createScript was called with the suggested content, attributed to the closer.
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO flow_scripts"),
      expect.arrayContaining(["card1", "New opener", "Prospects were confused by the old one"]),
    );

    // logChange recorded who approved it and why, tying back to the suggestion.
    const logCall = query.mock.calls[2];
    expect(logCall[0]).toContain("INSERT INTO flow_audit_log");
    expect(logCall[1]).toEqual(
      expect.arrayContaining(["org1", "flow_scripts", "script-new", "create"]),
    );
    expect(logCall[1][6]).toContain("Approved suggestion sug1 from closer@tag.test");
  });

  it("reject marks the suggestion resolved without touching flow_scripts", async () => {
    query
      .mockResolvedValueOnce({ rows: [pendingSuggestion] }) // getSuggestion
      .mockResolvedValueOnce({ rows: [{ id: "sug1", status: "rejected" }] }); // UPDATE suggestion

    const result = await resolveSuggestion("sug1", "reject", "manager@tag.test", "Not on-brand");

    expect(result.status).toBe("rejected");
    expect(query).toHaveBeenCalledTimes(2); // no createScript, no logChange
    const insertedScript = query.mock.calls.some((call) =>
      String(call[0]).includes("INSERT INTO flow_scripts"),
    );
    expect(insertedScript).toBe(false);
  });

  it("throws on a suggestion that was already resolved", async () => {
    query.mockResolvedValueOnce({ rows: [{ ...pendingSuggestion, status: "approved" }] });

    await expect(resolveSuggestion("sug1", "approve", "manager@tag.test")).rejects.toThrow(
      /already approved/,
    );
  });

  it("throws when the suggestion doesn't exist", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(resolveSuggestion("missing", "approve", "manager@tag.test")).rejects.toThrow(
      /not found/,
    );
  });
});
