import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Leak 1 (Phase 1 audit item 1.2): the route confirmed *a* session existed
 * but never that the session could access the requested org's location, so
 * any signed-in user could read any org's FLOW framework by editing the
 * URL. This covers that the route now enforces requireLocationAccess and
 * turns a denial into a 403 instead of leaking the framework.
 */

const getSession = vi.fn();
const requireLocationAccess = vi.fn();
const getFullFramework = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
  requireLocationAccess: (locationId: string) => requireLocationAccess(locationId),
}));

vi.mock("@/lib/flow/db", () => ({
  getFullFramework: (orgId: string) => getFullFramework(orgId),
}));

const { GET } = await import("@/app/api/flow/org/[orgId]/framework/route");

function get(orgId: string) {
  return GET(new Request(`http://localhost:3000/api/flow/org/${orgId}/framework`) as never, {
    params: Promise.resolve({ orgId }),
  });
}

function csmSession(locations: string[]) {
  return {
    uid: "csm-a",
    email: "csm-a@tag.com",
    currentRole: "tag_csm",
    availableRoles: ["tag_csm"],
    locations,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/flow/org/[orgId]/framework", () => {
  it("returns 403, not the framework, when the session cannot access the org", async () => {
    getSession.mockResolvedValue(csmSession(["org-a"]));
    requireLocationAccess.mockRejectedValue(
      new Error("403 Forbidden: location org-b not in permitted locations: org-a"),
    );

    const response = await get("org-b");

    expect(response.status).toBe(403);
    expect(requireLocationAccess).toHaveBeenCalledWith("org-b");
    expect(getFullFramework).not.toHaveBeenCalled();
  });

  it("returns the framework when the session can access the org", async () => {
    getSession.mockResolvedValue(csmSession(["org-a"]));
    requireLocationAccess.mockResolvedValue(undefined);
    getFullFramework.mockResolvedValue({ id: "fw1", tabs: [] });

    const response = await get("org-a");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "fw1", tabs: [] });
  });

  it("returns 401 and never checks location access when there is no session", async () => {
    getSession.mockResolvedValue(null);

    const response = await get("org-a");

    expect(response.status).toBe(401);
    expect(requireLocationAccess).not.toHaveBeenCalled();
    expect(getFullFramework).not.toHaveBeenCalled();
  });
});
