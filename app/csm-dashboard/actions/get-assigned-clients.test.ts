import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Leak 3 (Phase 1 audit item 1.2): this action never called any session
 * function, so any signed-in user could pull any CSM's book by passing
 * their email. Covers the CSM-own-book restriction and confirms the
 * three-tier CS rollup's cross-visibility (tag_csd/tag_exec/admin) is
 * preserved, not blocked.
 */

const requireSession = vi.fn();
const getAssignedClients = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireSession: () => requireSession(),
}));

vi.mock("@/lib/dashboard/csm-clients", () => ({
  getAssignedClients: (csmEmail: string) => getAssignedClients(csmEmail),
}));

const { getAssignedClientsForCSM } = await import("./get-assigned-clients");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAssignedClientsForCSM", () => {
  it("rejects a CSM fetching a different CSM's book", async () => {
    requireSession.mockResolvedValue({
      uid: "csm-a",
      email: "csm-a@tag.com",
      currentRole: "tag_csm",
      availableRoles: ["tag_csm"],
      locations: ["loc-a"],
    });

    await expect(getAssignedClientsForCSM("csm-b@tag.com")).rejects.toThrow();
    expect(getAssignedClients).not.toHaveBeenCalled();
  });

  it("allows a CSM to fetch their own book", async () => {
    requireSession.mockResolvedValue({
      uid: "csm-a",
      email: "csm-a@tag.com",
      currentRole: "tag_csm",
      availableRoles: ["tag_csm"],
      locations: ["loc-a"],
    });
    getAssignedClients.mockResolvedValue([]);

    await getAssignedClientsForCSM("csm-a@tag.com");
    expect(getAssignedClients).toHaveBeenCalledWith("csm-a@tag.com");
  });

  it.each(["tag_csd", "tag_exec", "admin"])(
    "allows %s cross-visibility into another CSM's book",
    async (currentRole) => {
      requireSession.mockResolvedValue({
        uid: "internal-1",
        email: "internal-1@tag.com",
        currentRole,
        availableRoles: [currentRole],
        locations: [],
      });
      getAssignedClients.mockResolvedValue([]);

      await getAssignedClientsForCSM("csm-b@tag.com");
      expect(getAssignedClients).toHaveBeenCalledWith("csm-b@tag.com");
    },
  );
});
