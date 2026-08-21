import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * The carried-forward defect this route exists to not repeat: the Next
 * portfolio page ran `Promise.all` over getTenant, so a single unreachable
 * tenant rejected the whole batch and the switcher rendered as "no clients
 * assigned" — a failure wearing an empty result's clothes.
 *
 * These tests pin the two halves of the fix: the healthy tenants still come
 * back, and the broken one is reported rather than silently dropped.
 */

const requireApiSession = vi.fn();
vi.mock("@/lib/auth/api-session", () => ({
  requireApiSession: (context: string) => requireApiSession(context),
}));

// Stubbed so the module graph does not pull firebase-admin into the test.
vi.mock("@/lib/auth/session-cookie", () => ({
  apiError: (message: string, context: string, status: number) =>
    NextResponse.json({ message, context, status }, { status }),
}));

const getTenant = vi.fn();
vi.mock("@/lib/ghl/tenants", () => ({
  getTenant: (locationId: string) => getTenant(locationId),
}));

const { GET } = await import("./route");

type PortfolioBody = {
  tenants: { locationId: string; name: string }[];
  unavailable: { count: number; locationIds: string[] };
  canEnter: boolean;
};

function signedIn(session: Record<string, unknown>) {
  requireApiSession.mockResolvedValue({ ok: true, session });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/portfolio/tenants", () => {
  it("keeps the reachable tenants when one lookup fails, and names the one that did not", async () => {
    signedIn({ uid: "u1", currentRole: ROLES.TAG_CSM, locations: ["locA", "locBroken", "locB"] });
    getTenant.mockImplementation(async (locationId: string) => {
      if (locationId === "locBroken") throw new Error("Firestore unavailable");
      return { locationId, name: locationId === "locA" ? "Zeta Co" : "Alpha Co" };
    });

    const response = await GET();
    const body = (await response.json()) as PortfolioBody;

    expect(response.status).toBe(200);
    // The regression: this was [] before, for all three.
    expect(body.tenants.map((t) => t.locationId)).toEqual(["locB", "locA"]);
    expect(body.unavailable).toEqual({ count: 1, locationIds: ["locBroken"] });
  });

  it("sorts by name and reports nothing unavailable when every lookup succeeds", async () => {
    signedIn({ uid: "u1", currentRole: ROLES.TAG_CSM, locations: ["loc1", "loc2"] });
    getTenant.mockImplementation(async (locationId: string) => ({
      locationId,
      name: locationId === "loc1" ? "Beta Co" : "Alpha Co",
    }));

    const body = (await (await GET()).json()) as PortfolioBody;

    expect(body.tenants.map((t) => t.name)).toEqual(["Alpha Co", "Beta Co"]);
    expect(body.unavailable.count).toBe(0);
  });

  it("only looks up the session's own locations", async () => {
    signedIn({ uid: "u1", currentRole: ROLES.TAG_CSM, locations: ["mine"] });
    getTenant.mockResolvedValue({ locationId: "mine", name: "Mine" });

    await GET();

    expect(getTenant).toHaveBeenCalledTimes(1);
    expect(getTenant).toHaveBeenCalledWith("mine");
  });

  it("flags enter as available only for the CSM hat", async () => {
    signedIn({ uid: "u1", currentRole: ROLES.TAG_EXEC, locations: [] });
    const execBody = (await (await GET()).json()) as PortfolioBody;
    expect(execBody.canEnter).toBe(false);

    signedIn({ uid: "u1", currentRole: ROLES.TAG_CSM, locations: [] });
    const csmBody = (await (await GET()).json()) as PortfolioBody;
    expect(csmBody.canEnter).toBe(true);
  });

  it("passes the gate's 401 straight through", async () => {
    requireApiSession.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ message: "Not signed in" }, { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getTenant).not.toHaveBeenCalled();
  });

  it("answers 500 rather than an empty list when the lookup throws synchronously", async () => {
    signedIn({ uid: "u1", currentRole: ROLES.TAG_CSM, locations: ["loc1"] });
    getTenant.mockImplementation(() => {
      throw new Error("GOOGLE_CLOUD_PROJECT is not set.");
    });

    const response = await GET();

    expect(response.status).toBe(500);
  });
});
