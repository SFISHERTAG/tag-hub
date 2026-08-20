import { describe, expect, it, vi, beforeEach } from "vitest";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * Covers the two ordering constraints in this pair, because both are invisible
 * in ordinary testing and fatal in an audit.
 *
 * On enter, the audit document must be created BEFORE the cookie is set: the
 * cookie carries the Firestore auto-id, which does not exist until the document
 * does, and a crash between the two must leave a record with no access rather
 * than access with no record. On exit it is the mirror — close the entry before
 * clearing the cookie, because the cookie holds the only copy of the
 * correlation id.
 *
 * Also covers the ownership check. Every value in hub_impersonation arrives from
 * an unsigned cookie; httpOnly stops page scripts reading it and does nothing
 * about a crafted request.
 */

const getSession = vi.fn();
const getImpersonation = vi.fn();
const createImpersonationEntry = vi.fn();
const closeImpersonationEntry = vi.fn();
const isValidLocationId = vi.fn();

const callOrder: string[] = [];

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    getSession: () => getSession(),
    getImpersonation: () => getImpersonation(),
  };
});

vi.mock("@/lib/audit/store", () => ({
  createImpersonationEntry: (...args: unknown[]) => {
    callOrder.push("audit:create");
    return createImpersonationEntry(...args);
  },
  closeImpersonationEntry: (...args: unknown[]) => {
    callOrder.push("audit:close");
    return closeImpersonationEntry(...args);
  },
}));

vi.mock("@/lib/ghl/tenants", () => ({
  isValidLocationId: (id: string) => isValidLocationId(id),
}));

const { POST: enter } = await import("@/app/api/impersonation/enter/route");
const { POST: exit } = await import("@/app/api/impersonation/exit/route");

function request(body: unknown, { origin = "http://localhost:3000" } = {}) {
  return new Request("http://localhost:3000/api/impersonation/x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      origin,
    },
    body: JSON.stringify(body),
  }) as never;
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    uid: "csm-1",
    email: "csm@taxadvisorygrowth.net",
    currentRole: ROLES.TAG_CSM,
    availableRoles: [ROLES.TAG_CSM],
    locations: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  isValidLocationId.mockReturnValue(true);
  getImpersonation.mockResolvedValue(null);
  createImpersonationEntry.mockResolvedValue("audit-1");
  closeImpersonationEntry.mockResolvedValue(true);
});

describe("POST /api/impersonation/enter", () => {
  it("writes the audit entry before setting the cookie", async () => {
    getSession.mockResolvedValue(session());

    const response = await enter(request({ locationId: "loc-9" }));

    expect(response.status).toBe(200);
    expect(callOrder).toEqual(["audit:create"]);

    const cookie = response.cookies.get("hub_impersonation");
    expect(cookie).toBeDefined();
    // The auto-id from the audit write is inside the cookie, which is only
    // possible if the write happened first.
    expect(JSON.parse(cookie?.value ?? "{}")).toEqual({
      locationId: "loc-9",
      auditEntryId: "audit-1",
      actorId: "csm-1",
    });
  });

  it("reports the new impersonation in the payload", async () => {
    getSession.mockResolvedValue(session());

    const body = await (await enter(request({ locationId: "loc-9" }))).json();

    // Re-reading the incoming jar here would answer null, immediately after
    // starting one.
    expect(body.impersonation).toEqual({ locationId: "loc-9" });
  });

  it("does not echo the audit id or actor back to the browser", async () => {
    getSession.mockResolvedValue(session());

    const body = await (await enter(request({ locationId: "loc-9" }))).json();

    expect(body.impersonation).not.toHaveProperty("auditEntryId");
    expect(body.impersonation).not.toHaveProperty("actorId");
  });

  it("refuses a role other than client services", async () => {
    getSession.mockResolvedValue(session({ currentRole: ROLES.CLIENT_CLOSER }));

    expect((await enter(request({ locationId: "loc-9" }))).status).toBe(403);
    expect(createImpersonationEntry).not.toHaveBeenCalled();
  });

  it("refuses an unknown location without writing an audit entry", async () => {
    getSession.mockResolvedValue(session());
    isValidLocationId.mockReturnValue(false);

    expect((await enter(request({ locationId: "nope" }))).status).toBe(400);
    expect(createImpersonationEntry).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request before authenticating", async () => {
    const response = await enter(
      request({ locationId: "loc-9" }, { origin: "https://evil.example.com" }),
    );

    expect(response.status).toBe(403);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("401s when signed out", async () => {
    getSession.mockResolvedValue(null);

    expect((await enter(request({ locationId: "loc-9" }))).status).toBe(401);
    expect(createImpersonationEntry).not.toHaveBeenCalled();
  });
});

describe("POST /api/impersonation/exit", () => {
  it("closes the audit entry before clearing the cookie", async () => {
    getSession.mockResolvedValue(session());
    getImpersonation.mockResolvedValue({
      locationId: "loc-9",
      auditEntryId: "audit-1",
      actorId: "csm-1",
    });

    const response = await exit(request({}));

    expect(callOrder).toEqual(["audit:close"]);
    expect(closeImpersonationEntry).toHaveBeenCalledWith("loc-9", "audit-1", "csm-1");
    // Cleared, not merely absent.
    expect(response.cookies.get("hub_impersonation")?.value).toBe("");
  });

  it("refuses to close an entry belonging to another session", async () => {
    getSession.mockResolvedValue(session({ uid: "csm-1" }));
    getImpersonation.mockResolvedValue({
      locationId: "loc-9",
      auditEntryId: "audit-1",
      // A crafted cookie naming someone else's impersonation.
      actorId: "someone-else",
    });

    const response = await exit(request({}));

    expect(response.status).toBe(403);
    // Never reaches Firestore at all.
    expect(closeImpersonationEntry).not.toHaveBeenCalled();
  });

  it("succeeds when there is nothing to exit", async () => {
    getSession.mockResolvedValue(session());
    getImpersonation.mockResolvedValue(null);

    const response = await exit(request({}));

    expect(response.status).toBe(200);
    expect(closeImpersonationEntry).not.toHaveBeenCalled();
    expect((await response.json()).impersonation).toBeNull();
  });

  it("reports impersonation as null in the payload", async () => {
    getSession.mockResolvedValue(session());
    getImpersonation.mockResolvedValue({
      locationId: "loc-9",
      auditEntryId: "audit-1",
      actorId: "csm-1",
    });

    const body = await (await exit(request({}))).json();

    // Re-reading the incoming jar would report the impersonation just ended as
    // still active, and the client replaces its session wholesale from this.
    expect(body.impersonation).toBeNull();
  });

  it("401s when signed out", async () => {
    getSession.mockResolvedValue(null);

    expect((await exit(request({}))).status).toBe(401);
    expect(closeImpersonationEntry).not.toHaveBeenCalled();
  });
});
