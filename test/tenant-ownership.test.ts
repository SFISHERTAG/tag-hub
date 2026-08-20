import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Role } from "@/lib/auth/roles";

/**
 * Resweep critical group 1: a server action or route handler that accepts a
 * caller-supplied tenant id must check it against the caller's own session.
 * These cover the gate itself — `requireOwnedLocation`, `requireOwnedClient`,
 * `requireInternalRole` — so the seven call sites that now use it are testing
 * one implementation rather than seven copies of the same `if`.
 */

const verifySessionCookie = vi.fn();
const cookieStore = new Map<string, { value: string }>();
let liveClaims: Record<string, unknown> | undefined;
const clientDocs = new Map<string, Record<string, unknown>>();

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
  listAllLocationIds: vi.fn(async () => ["tenant-a", "tenant-b"]),
}));

vi.mock("@/lib/firestore", () => ({
  firestore: () => ({
    collection: () => ({
      doc: (id: string) => ({
        async get() {
          const found = clientDocs.get(id);
          return { exists: !!found, data: () => found };
        },
      }),
    }),
  }),
}));

const {
  requireOwnedLocation,
  requireOwnedClient,
  requireInternalRole,
  ForbiddenError,
  UnauthenticatedError,
} = await import("@/lib/auth/session");

function signInAs(role: Role, locations: string[], uid = "user-a") {
  cookieStore.set("hub_session", { value: "valid-cookie" });
  verifySessionCookie.mockResolvedValue({
    uid,
    email: `${uid}@tenant.test`,
    roles: [{ role, locations }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.clear();
  liveClaims = undefined;
  clientDocs.clear();
  clientDocs.set("client-a", { ghl_location_id: "tenant-a", csm_assigned: "csm@tag.test" });
  clientDocs.set("client-b", { ghl_location_id: "tenant-b", csm_assigned: "other@tag.test" });
});

describe("requireOwnedLocation", () => {
  it("throws 401 rather than redirecting when there is no session", async () => {
    // A redirect thrown out of a POST handler surfaces as an opaque failure;
    // route handlers need the status.
    await expect(requireOwnedLocation("tenant-a")).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws 403 for a client_closer on someone else's tenant", async () => {
    signInAs("client_closer", ["tenant-a"]);
    await expect(requireOwnedLocation("tenant-b")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns the session for the caller's own tenant", async () => {
    signInAs("client_closer", ["tenant-a"]);
    const session = await requireOwnedLocation("tenant-a");
    expect(session.uid).toBe("user-a");
  });

  it("lets tag_exec reach any tenant", async () => {
    signInAs("tag_exec", []);
    await expect(requireOwnedLocation("tenant-b")).resolves.toBeDefined();
  });

  it("refuses an empty location id instead of treating it as a wildcard", async () => {
    signInAs("client_closer", ["tenant-a"]);
    await expect(requireOwnedLocation("")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("requireOwnedClient", () => {
  it("lets TAG staff read any client, per the CS coverage model", async () => {
    signInAs("tag_csm", []);
    const { locationId } = await requireOwnedClient("client-b");
    // Staff skip the document read entirely, so no location comes back.
    expect(locationId).toBeNull();
  });

  it("refuses a client-tenant role reading a different tenant's client record", async () => {
    signInAs("client_owner", ["tenant-a"]);
    await expect(requireOwnedClient("client-b")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("resolves a client-tenant role to their own client record", async () => {
    signInAs("client_owner", ["tenant-a"]);
    const { locationId } = await requireOwnedClient("client-a");
    expect(locationId).toBe("tenant-a");
  });

  it("gives a missing client the same error as a forbidden one", async () => {
    // Otherwise the difference in errors enumerates which client ids exist.
    signInAs("client_owner", ["tenant-a"]);
    await expect(requireOwnedClient("client-does-not-exist")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("requireInternalRole", () => {
  it("refuses a client-tenant role", async () => {
    signInAs("client_manager", ["tenant-a"]);
    await expect(requireInternalRole()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows a CSM", async () => {
    signInAs("tag_csm", ["tenant-a"]);
    await expect(requireInternalRole()).resolves.toBeDefined();
  });
});

describe("live claims", () => {
  it("applies a role downgrade without waiting for the cookie to expire", async () => {
    // The cookie still says client_owner on tenant-a. The admin has since
    // moved this user off that account. Before roles were read live, the
    // stale cookie kept working for up to 14 days.
    signInAs("client_owner", ["tenant-a"]);
    liveClaims = { roles: [{ role: "client_owner", locations: ["tenant-z"] }] };

    await expect(requireOwnedLocation("tenant-a")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireOwnedLocation("tenant-z")).resolves.toBeDefined();
  });

  it("treats cleared claims as signed out", async () => {
    signInAs("tag_exec", []);
    liveClaims = { roles: [] };

    await expect(requireOwnedLocation("tenant-a")).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("falls back to the cookie's claims when the live lookup fails", async () => {
    // An Admin SDK blip must not sign every signed-in user out.
    signInAs("client_owner", ["tenant-a"]);
    liveClaims = undefined;

    await expect(requireOwnedLocation("tenant-a")).resolves.toBeDefined();
  });
});
