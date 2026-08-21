import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * The defect this gate exists to close.
 *
 * The `/api/clients/[clientId]/**` routes were ported with a role check only.
 * The reasoning, written into one of their comments, was that dropping the
 * `locationId` parameter had removed the audit's caller-supplied-id pattern:
 * "there is nothing to validate if the caller never supplies it."
 *
 * The caller still supplies `clientId`, and `clientId` selects the location. It
 * is the same question one indirection later. `CSM_BOOK_ROLES` includes
 * `tag_csm`, which is tenant-scoped in this codebase's own model, so the role
 * established "staff" and never "which tenant" — and the routes behind it reach
 * Meta and Google Drive, neither of which re-checks anything.
 *
 * These pin the fix: staff alone is not enough, the resolved location decides.
 */

const requireApiRole = vi.fn();
const requireApiLocationAccess = vi.fn();
const getClientRecord = vi.fn();

vi.mock("../../dashboard/_lib/http", () => ({
  requireApiRole: (roles: unknown, context: string) => requireApiRole(roles, context),
  notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
  unwrap: (result: { data: unknown; error: unknown }) => {
    if (result.error) throw result.error;
    return result.data;
  },
}));

vi.mock("@/lib/auth/api-session", () => ({
  requireApiLocationAccess: (locationId: string, context: string) =>
    requireApiLocationAccess(locationId, context),
}));

vi.mock("./client-record", () => ({
  getClientRecord: (clientId: string) => getClientRecord(clientId),
}));

vi.mock("../../dashboard/_lib/access", () => ({
  CSM_BOOK_ROLES: [ROLES.TAG_CSM, ROLES.TAG_CSD, ROLES.TAG_EXEC, ROLES.ADMIN],
}));

const { gateClient } = await import("./gate");

const CONTEXT = "GET /api/clients/[clientId]/test";
const STAFF = { uid: "csm-1", currentRole: ROLES.TAG_CSM, locations: ["loc-mine"] };

function record(overrides: Record<string, unknown> = {}) {
  return {
    data: { id: "client-1", name: "Acme", ghlLocationId: "loc-theirs", active: true, ...overrides },
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiRole.mockResolvedValue({ ok: true, session: STAFF });
  requireApiLocationAccess.mockResolvedValue({ ok: true, session: STAFF });
  getClientRecord.mockResolvedValue(record());
});

describe("gateClient", () => {
  it("refuses before resolving anything when the role is wrong", async () => {
    const denied = NextResponse.json({ message: "no" }, { status: 403 });
    requireApiRole.mockResolvedValue({ ok: false, response: denied });

    const gate = await gateClient("client-1", CONTEXT);

    expect(gate.ok).toBe(false);
    // The client record must not even be read for a caller who fails the role
    // check — that read is what leaks whether an id exists.
    expect(getClientRecord).not.toHaveBeenCalled();
  });

  it("checks the location resolved from the client, not one the caller supplied", async () => {
    await gateClient("client-1", CONTEXT);

    expect(requireApiLocationAccess).toHaveBeenCalledWith("loc-theirs", CONTEXT);
  });

  it("refuses staff whose session does not own the client's tenant", async () => {
    // This is the exploit the audit found: a tag_csm passing another CSM's
    // clientId, previously allowed because the role check passed.
    const denied = NextResponse.json({ message: "forbidden" }, { status: 403 });
    requireApiLocationAccess.mockResolvedValue({ ok: false, response: denied });

    const gate = await gateClient("client-1", CONTEXT);

    expect(gate.ok).toBe(false);
    if (gate.ok) throw new Error("unreachable");
    expect(gate.response.status).toBe(403);
  });

  it("allows staff who do own the tenant, and hands back the record", async () => {
    const gate = await gateClient("client-1", CONTEXT);

    expect(gate.ok).toBe(true);
    if (!gate.ok) throw new Error("unreachable");
    expect(gate.record.id).toBe("client-1");
  });

  it("does not attempt a location check for a client with no location yet", async () => {
    // A client provisioned but not yet linked to GHL has nothing to check
    // against. It is still gated on role, and reaches no external system.
    getClientRecord.mockResolvedValue(record({ ghlLocationId: undefined }));

    const gate = await gateClient("client-1", CONTEXT);

    expect(gate.ok).toBe(true);
    expect(requireApiLocationAccess).not.toHaveBeenCalled();
  });

  it("404s an unknown client rather than reporting it differently from a forbidden one", async () => {
    getClientRecord.mockResolvedValue({ data: null, error: null });

    await expect(gateClient("nope", CONTEXT)).rejects.toMatchObject({ status: 404 });
  });
});
