import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: this route (and 5 siblings under app/api/admin/flow/) gated on the
 * literal string "tag_admin", which isn't a role that exists in
 * lib/auth/role-labels.ts's ROLES — the real admin role is "admin". Every
 * admin was 403ing here regardless of their actual role. Fixed to
 * hasAnyRole(role, ["tag_exec", "admin"]).
 */

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
}));

const getAuditLog = vi.fn(async (..._args: [string, number?, number?]) => [{ id: "audit1" }]);
vi.mock("@/lib/flow/db", () => ({
  getAuditLog: (...args: [string, number?, number?]) => getAuditLog(...args),
}));

const { GET } = await import("./route");

function req() {
  return new Request("http://localhost:3000/api/admin/flow/org/org1/audit-log") as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/flow/org/[orgId]/audit-log role gate", () => {
  it("admits a session with the real admin role", async () => {
    getSession.mockResolvedValue({ currentRole: "admin", email: "admin@tag.test" });

    const res = await GET(req(), { params: Promise.resolve({ orgId: "org1" }) });

    expect(res.status).toBe(200);
    expect(getAuditLog).toHaveBeenCalled();
  });

  it("admits tag_exec", async () => {
    getSession.mockResolvedValue({ currentRole: "tag_exec", email: "exec@tag.test" });

    const res = await GET(req(), { params: Promise.resolve({ orgId: "org1" }) });

    expect(res.status).toBe(200);
  });

  it("rejects a non-admin role", async () => {
    getSession.mockResolvedValue({ currentRole: "client_closer", email: "closer@tag.test" });

    const res = await GET(req(), { params: Promise.resolve({ orgId: "org1" }) });

    expect(res.status).toBe(403);
    expect(getAuditLog).not.toHaveBeenCalled();
  });

  it("rejects no session", async () => {
    getSession.mockResolvedValue(null);

    const res = await GET(req(), { params: Promise.resolve({ orgId: "org1" }) });

    expect(res.status).toBe(403);
  });
});
