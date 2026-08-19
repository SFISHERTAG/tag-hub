import { describe, expect, it, vi, beforeEach } from "vitest";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * Story: nothing in this repo returned 401 to an unauthenticated API caller.
 * `requireSession()` and `requireLocationAccess()` both answer with
 * `redirect("/signin")`, which is correct for a page and wrong for an XHR — the
 * client receives a 307 and then an HTML document, so a failure reads as a
 * success. It also meant the Angular authInterceptor's mandated
 * refresh-on-401 had no 401 to fire on and was unreachable by construction.
 *
 * These tests pin the two things that must not regress: the status codes, and
 * the fact that requireApiLocationAccess mirrors requireLocationAccess exactly
 * (see test/require-location-access.test.ts for the page-side equivalent). Any
 * divergence between the two is a tenant-isolation bug.
 */

const getSession = vi.fn();
const getImpersonation = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
  getImpersonation: () => getImpersonation(),
}));

const { requireApiSession, requireApiLocationAccess } = await import("@/lib/auth/api-session");

const CONTEXT = "GET /api/test";

function session(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user1",
    email: "user@example.com",
    currentRole: ROLES.CLIENT_CLOSER,
    availableRoles: [ROLES.CLIENT_CLOSER],
    locations: ["loc1"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getImpersonation.mockResolvedValue(null);
  // Every path here logs; silence it so a passing run isn't full of red text.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("requireApiSession", () => {
  it("returns the session when signed in", async () => {
    getSession.mockResolvedValue(session());

    const result = await requireApiSession(CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.uid).toBe("user1");
  });

  it("returns 401 with an ApiError body when signed out", async () => {
    getSession.mockResolvedValue(null);

    const result = await requireApiSession(CONTEXT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.response.status).toBe(401);

    // The body must be an ApiError verbatim: the Angular errorInterceptor reads
    // `message` off the parsed body, so nesting it would silently produce
    // "undefined" in the UI.
    const body = await result.response.json();
    expect(body).toEqual({ message: "Not signed in", context: CONTEXT, status: 401 });
  });
});

describe("requireApiLocationAccess", () => {
  it("401s before any location check when signed out", async () => {
    getSession.mockResolvedValue(null);

    const result = await requireApiLocationAccess("loc1", CONTEXT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.response.status).toBe(401);
  });

  it("allows a location on the session's own grant", async () => {
    getSession.mockResolvedValue(session({ locations: ["loc1", "loc2"] }));

    const result = await requireApiLocationAccess("loc2", CONTEXT);

    expect(result.ok).toBe(true);
  });

  it.each([ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.ADMIN])("allows any location for %s", async (role) => {
    getSession.mockResolvedValue(session({ currentRole: role, locations: [] }));

    const result = await requireApiLocationAccess("some-other-location", CONTEXT);

    expect(result.ok).toBe(true);
  });

  it("403s for a location the session does not hold", async () => {
    getSession.mockResolvedValue(session({ locations: ["loc1"] }));

    const result = await requireApiLocationAccess("loc-not-mine", CONTEXT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.response.status).toBe(403);
  });

  it("does not leak the caller's other locations in the 403 body", async () => {
    getSession.mockResolvedValue(session({ locations: ["secret-loc-a", "secret-loc-b"] }));

    const result = await requireApiLocationAccess("loc-not-mine", CONTEXT);

    if (result.ok) throw new Error("expected failure");
    const body = await result.response.json();
    expect(body.message).not.toContain("secret-loc-a");
    expect(body.message).not.toContain("secret-loc-b");
  });

  it("allows a CSM into a location they are actively impersonating", async () => {
    getSession.mockResolvedValue(session({ currentRole: ROLES.TAG_CSM, locations: [] }));
    getImpersonation.mockResolvedValue({
      locationId: "entered-loc",
      auditEntryId: "audit1",
      actorId: "user1",
    });

    const result = await requireApiLocationAccess("entered-loc", CONTEXT);

    expect(result.ok).toBe(true);
  });

  it("refuses a CSM impersonation cookie belonging to a different actor", async () => {
    getSession.mockResolvedValue(session({ currentRole: ROLES.TAG_CSM, locations: [] }));
    getImpersonation.mockResolvedValue({
      locationId: "entered-loc",
      auditEntryId: "audit1",
      actorId: "someone-else",
    });

    const result = await requireApiLocationAccess("entered-loc", CONTEXT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.response.status).toBe(403);
  });

  it("refuses a CSM impersonation cookie for a different location", async () => {
    getSession.mockResolvedValue(session({ currentRole: ROLES.TAG_CSM, locations: [] }));
    getImpersonation.mockResolvedValue({
      locationId: "entered-loc",
      auditEntryId: "audit1",
      actorId: "user1",
    });

    const result = await requireApiLocationAccess("a-different-loc", CONTEXT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.response.status).toBe(403);
  });

  it("does not extend the impersonation path to non-CSM roles", async () => {
    getSession.mockResolvedValue(session({ currentRole: ROLES.CLIENT_CLOSER, locations: [] }));
    getImpersonation.mockResolvedValue({
      locationId: "entered-loc",
      auditEntryId: "audit1",
      actorId: "user1",
    });

    const result = await requireApiLocationAccess("entered-loc", CONTEXT);

    expect(result.ok).toBe(false);
  });
});
