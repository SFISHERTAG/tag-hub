import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * Covers the two things a hat switch must get right.
 *
 * Authorization: this is a callable endpoint, so the hat switcher only offering
 * roles the user holds is presentation, not enforcement.
 *
 * Derivation: `locations` is a function of the role. For tag_exec, tag_csd and
 * admin it is every known location; for anything else it is that role's own
 * grant. Patching `currentRole` on the session already in hand and returning it
 * would carry the previous hat's locations into the new one — switching DOWN
 * from tag_exec would report access to every tenant. The route re-resolves
 * instead, and this file pins that.
 */

const getSession = vi.fn();
const resolveSession = vi.fn();
const getImpersonation = vi.fn();
const closeImpersonationEntry = vi.fn();

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    getSession: () => getSession(),
    resolveSession: (cookie: string, role: string | undefined) => resolveSession(cookie, role),
    getImpersonation: () => getImpersonation(),
  };
});

vi.mock("@/lib/audit/store", () => ({
  closeImpersonationEntry: (...args: unknown[]) => closeImpersonationEntry(...args),
}));

const { POST } = await import("@/app/api/session/role/route");

function request(body: unknown, { origin = "http://localhost:3000", cookie = "session-cookie" } = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    host: "localhost:3000",
    origin,
  });
  if (cookie) headers.set("cookie", `hub_session=${cookie}`);
  // NextRequest, not Request: the route reads request.cookies, which only
  // exists on the Next wrapper.
  return new NextRequest(new URL("http://localhost:3000/api/session/role"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    uid: "u-1",
    email: "someone@taxadvisorygrowth.net",
    currentRole: ROLES.TAG_EXEC,
    availableRoles: [ROLES.TAG_EXEC, ROLES.CLIENT_CLOSER],
    locations: ["loc-1", "loc-2", "loc-3"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getSession.mockResolvedValue(session());
  getImpersonation.mockResolvedValue(null);
  closeImpersonationEntry.mockResolvedValue(true);
});

describe("POST /api/session/role", () => {
  it("narrows locations when switching down to a narrower hat", async () => {
    // The wide hat sees three locations; the narrow one holds a single grant.
    resolveSession.mockResolvedValue(
      session({ currentRole: ROLES.CLIENT_CLOSER, locations: ["loc-1"] }),
    );

    const body = await (await POST(request({ role: ROLES.CLIENT_CLOSER }))).json();

    expect(resolveSession).toHaveBeenCalledWith("session-cookie", ROLES.CLIENT_CLOSER);
    expect(body.currentRole).toBe(ROLES.CLIENT_CLOSER);
    // The failure this guards: carrying loc-2 and loc-3 across from tag_exec.
    expect(body.locations).toEqual(["loc-1"]);
  });

  it("refuses a role the caller does not hold", async () => {
    const response = await POST(request({ role: ROLES.ADMIN }));

    expect(response.status).toBe(403);
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it("refuses a value that is not a role at all", async () => {
    expect((await POST(request({ role: "tag_admin" }))).status).toBe(400);
    expect((await POST(request({ role: 42 }))).status).toBe(400);
  });

  it("sets the hat cookie", async () => {
    resolveSession.mockResolvedValue(session({ currentRole: ROLES.CLIENT_CLOSER, locations: [] }));

    const response = await POST(request({ role: ROLES.CLIENT_CLOSER }));

    expect(response.cookies.get("hub_role")?.value).toBe(ROLES.CLIENT_CLOSER);
  });

  it("closes and clears an active impersonation before switching", async () => {
    getImpersonation.mockResolvedValue({
      locationId: "loc-9",
      auditEntryId: "audit-1",
      actorId: "u-1",
    });
    resolveSession.mockResolvedValue(session({ currentRole: ROLES.CLIENT_CLOSER, locations: [] }));

    const response = await POST(request({ role: ROLES.CLIENT_CLOSER }));
    const body = await response.json();

    // Both session.ts and api-session.ts gate the impersonation grant on
    // tag_csm, so any other hat leaves a live cookie on a dead grant and an
    // audit entry that never closes.
    expect(closeImpersonationEntry).toHaveBeenCalledWith("loc-9", "audit-1", "u-1");
    expect(response.cookies.get("hub_impersonation")?.value).toBe("");
    expect(body.impersonation).toBeNull();
  });

  it("refuses a cross-site request before authenticating", async () => {
    const response = await POST(
      request({ role: ROLES.CLIENT_CLOSER }, { origin: "https://evil.example.com" }),
    );

    expect(response.status).toBe(403);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("401s when signed out", async () => {
    getSession.mockResolvedValue(null);

    expect((await POST(request({ role: ROLES.CLIENT_CLOSER }))).status).toBe(401);
  });

  it("marks the response no-store", async () => {
    resolveSession.mockResolvedValue(session({ currentRole: ROLES.CLIENT_CLOSER, locations: [] }));

    const response = await POST(request({ role: ROLES.CLIENT_CLOSER }));

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
