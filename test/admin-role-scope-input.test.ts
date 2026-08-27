import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ROLES } from "@/lib/auth/roles";

/**
 * readScope treated '' like null — "clear the override" — while every other
 * unknown value 400s. The shipped Angular client never sends '' (it converts
 * to null), so the branch was dead for it and a silent destructive clear for
 * any other caller: a scope the sender meant as a value, arriving empty,
 * quietly reverted the user's per-hat scope to the role default.
 */

const requireApiRole = vi.fn<(...args: unknown[]) => unknown>();
const assignIndividualRole = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const upsertCsmRecord = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);

vi.mock("../app/api/admin/_lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/api/admin/_lib/http")>();
  return { ...actual, requireApiRole: (...args: unknown[]) => requireApiRole(...args) };
});
vi.mock("@/lib/auth/groups", () => ({
  assignIndividualRole: (...args: unknown[]) => assignIndividualRole(...args),
}));
vi.mock("@/lib/dashboard/csm-directory", () => ({
  upsertCsmRecord: (...args: unknown[]) => upsertCsmRecord(...args),
}));

const { PUT } = await import("../app/api/admin/users/[uid]/role/route");

function put(body: Record<string, unknown>) {
  return PUT(
    new NextRequest(new URL("http://localhost/api/admin/users/uid-1/role"), {
      method: "PUT",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ uid: "uid-1" }) },
  );
}

beforeEach(() => {
  requireApiRole.mockResolvedValue({ ok: true, session: { uid: "admin-1" } });
  assignIndividualRole.mockClear();
});

describe("scope input parsing", () => {
  it("rejects an empty-string scope like any other unknown value", async () => {
    const response = await put({ role: ROLES.CLIENT_CLOSER, scope: "" });
    expect(response.status).toBe(400);
    expect(assignIndividualRole).not.toHaveBeenCalled();
  });

  it("still clears the override on an explicit null", async () => {
    const response = await put({ role: ROLES.CLIENT_CLOSER, scope: null });
    expect(response.status).toBe(200);
    expect(assignIndividualRole).toHaveBeenCalledWith("uid-1", ROLES.CLIENT_CLOSER, [], undefined, undefined);
  });

  it("still rejects a value outside the closed set", async () => {
    const response = await put({ role: ROLES.CLIENT_CLOSER, scope: "everyone" });
    expect(response.status).toBe(400);
  });
});
