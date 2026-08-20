import { describe, expect, it, vi, beforeEach } from "vitest";
import { ROLES } from "@/lib/auth/roles";

/**
 * Story 1.4 AC: a session scoped to one tenant must not reach another tenant's
 * data through `requireLocationAccess`, the guard every `lib/ghl/client.ts`
 * call runs before touching GHL.
 */

const verifySessionCookie = vi.fn();
const cookieStore = new Map<string, { value: string }>();
let liveClaims: Record<string, unknown> | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: () => ({ verifySessionCookie }),
  // Roles are read from the live claims, not the cookie snapshot. Returning
  // undefined here means "no live claims available", which is the documented
  // fall-back-to-cookie path — the tests below set roles on the cookie.
  getLiveClaims: async () => liveClaims,
  SESSION_COOKIE: "hub_session",
}));

vi.mock("@/lib/ghl/tenants", () => ({
  listAllLocationIds: vi.fn(async () => []),
}));

const { requireLocationAccess, getSession } = await import("@/lib/auth/session");

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.clear();
  liveClaims = undefined;
});

describe("requireLocationAccess", () => {
  it("throws 403 for a client_closer on a tenant outside their grant", async () => {
    cookieStore.set("hub_session", { value: "valid-cookie" });
    verifySessionCookie.mockResolvedValue({
      uid: "user-a",
      email: "closer@tenant-a.test",
      roles: [{ role: "client_closer", locations: ["tenant-a"] }],
    });

    await expect(requireLocationAccess("tenant-b")).rejects.toThrow(/403/);
  });

  it("allows a client_closer to access their own tenant", async () => {
    cookieStore.set("hub_session", { value: "valid-cookie" });
    verifySessionCookie.mockResolvedValue({
      uid: "user-a",
      email: "closer@tenant-a.test",
      roles: [{ role: "client_closer", locations: ["tenant-a"] }],
    });

    await expect(requireLocationAccess("tenant-a")).resolves.toBeUndefined();
  });
});

/**
 * Resweep High finding: role claims were baked into the session cookie at
 * sign-in and never re-read, so an admin's role change did not take effect
 * until that user next signed in — up to 14 days. Roles now come from the
 * live claims, cached briefly, with the cookie as a fallback.
 */
describe("live role claims", () => {
  function signedInAs(role: string, locations: string[]) {
    cookieStore.set("hub_session", { value: "valid-cookie" });
    verifySessionCookie.mockResolvedValue({
      uid: "user-a",
      email: "user-a@tenant.test",
      roles: [{ role, locations }],
    });
  }

  it("applies a downgrade without waiting for the cookie to expire", async () => {
    // The cookie still says tenant-a. The admin has since moved this user.
    signedInAs(ROLES.CLIENT_CLOSER, ["tenant-a"]);
    liveClaims = { roles: [{ role: ROLES.CLIENT_CLOSER, locations: ["tenant-z"] }] };

    await expect(requireLocationAccess("tenant-a")).rejects.toThrow(/403/);
    await expect(requireLocationAccess("tenant-z")).resolves.toBeUndefined();
  });

  it("treats cleared claims as signed out", async () => {
    signedInAs(ROLES.CLIENT_CLOSER, ["tenant-a"]);
    liveClaims = { roles: [] };

    await expect(getSession()).resolves.toBeNull();
  });

  it("falls back to the cookie's claims when the live lookup is unavailable", async () => {
    // An Admin SDK blip must not sign every signed-in user out.
    signedInAs(ROLES.CLIENT_CLOSER, ["tenant-a"]);
    liveClaims = undefined;

    await expect(requireLocationAccess("tenant-a")).resolves.toBeUndefined();
  });

  it("keeps scope and team from the live claims", async () => {
    // parseRoleGrants carries these; dropping them would silently narrow or
    // widen a scoped role.
    signedInAs(ROLES.TAG_CSM, ["tenant-a"]);
    liveClaims = {
      roles: [{ role: ROLES.TAG_CSM, locations: ["tenant-a"], scope: "team", team: ["uid-1"] }],
    };

    const session = await getSession();
    expect(session?.scope).toBe("team");
    expect(session?.team).toEqual(["uid-1"]);
  });
});
