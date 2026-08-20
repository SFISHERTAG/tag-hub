import { describe, expect, it, vi, beforeEach } from "vitest";

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

const { requireLocationAccess } = await import("@/lib/auth/session");

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
