import { describe, expect, it, vi, beforeEach } from "vitest";
import { ROLES } from "@/lib/auth/roles";

/**
 * Story 1.4 AC: a session scoped to one tenant must not reach another tenant's
 * data through `requireLocationAccess`, the guard every `lib/ghl/client.ts`
 * call runs before touching GHL.
 */

const verifySessionCookie = vi.fn();
const cookieStore = new Map<string, { value: string }>();

/**
 * Controls the live-claims lookup. `undefined` means "no live claims
 * available", which is the documented fall-back-to-cookie path; setting
 * `liveClaimsError` makes the lookup itself fail, which is the other one.
 */
let liveClaims: Record<string, unknown> | undefined;
let liveClaimsError: Error | null = null;

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
  // Roles are read from the live claims, not from the cookie snapshot. A mock
  // that omits this would make every test here silently exercise the fallback
  // path and still pass, which is the whole failure this fix is about.
  getLiveClaims: async () => {
    if (liveClaimsError) throw liveClaimsError;
    return liveClaims;
  },
  SESSION_COOKIE: "hub_session",
}));

vi.mock("@/lib/ghl/tenants", () => ({
  listAllLocationIds: vi.fn(async () => []),
}));

const { requireLocationAccess } = await import("@/lib/auth/session");

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.clear();
  liveClaims = undefined;
  liveClaimsError = null;
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

describe("live role claims", () => {
  function signedInAs(roles: unknown) {
    cookieStore.set("hub_session", { value: "valid-cookie" });
    verifySessionCookie.mockResolvedValue({
      uid: "user-a",
      email: "closer@tenant-a.test",
      roles,
    });
  }

  it("applies a role downgrade without waiting for the cookie to expire", async () => {
    // The cookie still grants tenant-a. An admin has since moved this user to
    // tenant-z. Before roles were read live, the stale cookie kept working for
    // up to 14 days.
    signedInAs([{ role: ROLES.CLIENT_CLOSER, locations: ["tenant-a"] }]);
    liveClaims = { roles: [{ role: ROLES.CLIENT_CLOSER, locations: ["tenant-z"] }] };

    await expect(requireLocationAccess("tenant-a")).rejects.toThrow(/403/);
    await expect(requireLocationAccess("tenant-z")).resolves.toBeUndefined();
  });

  it("treats cleared claims as signed out", async () => {
    signedInAs([{ role: ROLES.CLIENT_CLOSER, locations: ["tenant-a"] }]);
    liveClaims = { roles: [] };

    // No session at all now, so the guard redirects rather than 403s.
    await expect(requireLocationAccess("tenant-a")).rejects.toThrow("REDIRECT");
  });

  it("falls back to the cookie's claims when the live lookup fails", async () => {
    // An Admin SDK blip must not sign every signed-in user out.
    signedInAs([{ role: ROLES.CLIENT_CLOSER, locations: ["tenant-a"] }]);
    liveClaimsError = new Error("Admin SDK unavailable");

    await expect(requireLocationAccess("tenant-a")).resolves.toBeUndefined();
  });

  it("preserves scope and team from the live claims", async () => {
    // parseRoleGrants is shared by both paths; a helper that dropped these
    // would silently narrow every scoped grant to the role default.
    signedInAs([{ role: ROLES.CLIENT_CLOSER, locations: ["tenant-a"] }]);
    liveClaims = {
      roles: [
        { role: ROLES.CLIENT_CLOSER, locations: ["tenant-a"], scope: "team", team: ["uid-1"] },
      ],
    };

    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    expect(session?.scope).toBe("team");
    expect(session?.team).toEqual(["uid-1"]);
  });
});
