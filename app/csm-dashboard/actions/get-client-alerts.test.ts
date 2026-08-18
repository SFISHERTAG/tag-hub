import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Leak 3 (Phase 1 audit item 1.2): this action never called any session
 * function, so any signed-in user could fetch any client's alerts by
 * clientId regardless of which CSM or location they're scoped to. This
 * covers that a session scoped to CSM A's location cannot fetch a client
 * belonging to CSM B's location.
 */

const requireSession = vi.fn();
const requireLocationAccess = vi.fn();
const getClientLocationId = vi.fn();
const getClientAlerts = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireSession: () => requireSession(),
  requireLocationAccess: (locationId: string) => requireLocationAccess(locationId),
}));

vi.mock("@/lib/dashboard/csm-clients", () => ({
  getClientLocationId: (clientId: string) => getClientLocationId(clientId),
  getClientAlerts: (clientId: string) => getClientAlerts(clientId),
}));

const { getClientAlertsForClient } = await import("./get-client-alerts");

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

describe("getClientAlertsForClient", () => {
  it("rejects a client belonging to a location the session cannot access", async () => {
    requireSession.mockResolvedValue(csmSession(["loc-a"]));
    getClientLocationId.mockResolvedValue("loc-b");
    requireLocationAccess.mockRejectedValue(
      new Error("403 Forbidden: location loc-b not in permitted locations: loc-a"),
    );

    await expect(getClientAlertsForClient("client-b")).rejects.toThrow();

    expect(requireLocationAccess).toHaveBeenCalledWith("loc-b");
    expect(getClientAlerts).not.toHaveBeenCalled();
  });

  it("returns alerts when the session can access the client's location", async () => {
    requireSession.mockResolvedValue(csmSession(["loc-a"]));
    getClientLocationId.mockResolvedValue("loc-a");
    requireLocationAccess.mockResolvedValue(undefined);
    getClientAlerts.mockResolvedValue([
      { id: "a1", type: "info", title: "t", message: "m", created_at: "now" },
    ]);

    const alerts = await getClientAlertsForClient("client-a");

    expect(alerts).toHaveLength(1);
    expect(getClientAlerts).toHaveBeenCalledWith("client-a");
  });

  it("rejects rather than proceeding when the client has no resolvable location", async () => {
    requireSession.mockResolvedValue(csmSession(["loc-a"]));
    getClientLocationId.mockResolvedValue(null);

    await expect(getClientAlertsForClient("missing-client")).rejects.toThrow();

    expect(requireLocationAccess).not.toHaveBeenCalled();
    expect(getClientAlerts).not.toHaveBeenCalled();
  });
});
