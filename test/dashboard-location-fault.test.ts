import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/roles";

/**
 * The defect this pins, and why it is worth a test rather than a comment.
 *
 * `resolveDashboardLocation` used to be `catch { return null }`. Two conditions
 * arrived there and both became the same null:
 *
 *   a client role with no assigned location -- expected, and sample data is a
 *   fair answer to it;
 *   GHL_LOCATION_ID_TAG_GROWTH unset -- a deploy fault that silently converts
 *   every internal user's live funnel into a fixture.
 *
 * The response still rendered and still disclosed "sample" to the viewer, so
 * nothing looked broken from the outside. Nobody operating the system was told.
 * These tests assert the two are now told apart, and that only the deploy fault
 * escalates.
 */

const postAlert = vi.fn<(text: string) => Promise<void>>();
const slackConfigured = vi.fn<() => boolean>();

vi.mock("@/lib/slack", () => ({
  postAlert: (text: string) => postAlert(text),
  slackConfigured: () => slackConfigured(),
}));

function session(overrides: Partial<Session> = {}): Session {
  return {
    uid: "u1",
    email: "someone@taxadvisorygrowth.com",
    currentRole: ROLES.TAG_CSM,
    availableRoles: [ROLES.TAG_CSM],
    locations: [],
    grants: [],
    ...overrides,
  } as Session;
}

async function load() {
  const mod = await import("@/app/api/dashboard/_lib/access");
  return mod.resolveDashboardLocation;
}

beforeEach(() => {
  vi.resetModules();
  postAlert.mockReset().mockResolvedValue(undefined);
  slackConfigured.mockReset().mockReturnValue(true);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resolveDashboardLocation", () => {
  it("escalates when the agency location is not configured", async () => {
    vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resolve = await load();

    expect(resolve(session())).toBeNull();

    expect(postAlert).toHaveBeenCalledTimes(1);
    expect(postAlert.mock.calls[0]?.[0]).toContain("GHL_LOCATION_ID_TAG_GROWTH");
  });

  it("does NOT escalate for a client role that simply has no location", async () => {
    // The condition the old catch could not tell apart from the one above.
    const resolve = await load();

    expect(resolve(session({ currentRole: ROLES.CLIENT_OWNER, availableRoles: [ROLES.CLIENT_OWNER] }))).toBeNull();

    expect(postAlert).not.toHaveBeenCalled();
  });

  it("resolves normally when the agency location is configured", async () => {
    vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "loc_agency");
    const resolve = await load();

    expect(resolve(session())).toBe("loc_agency");
    expect(postAlert).not.toHaveBeenCalled();
  });

  it("alerts once per window, not once per request", async () => {
    // A config fault fires on every dashboard request across four widget
    // routes. Alerting per occurrence would post hundreds of identical
    // messages and teach everyone to mute the channel.
    vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resolve = await load();

    resolve(session());
    resolve(session());
    resolve(session());

    expect(postAlert).toHaveBeenCalledTimes(1);
  });

  it("still returns null when Slack is not configured", async () => {
    // Alerting must never be the reason a dashboard request fails.
    vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "");
    slackConfigured.mockReturnValue(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resolve = await load();

    expect(resolve(session())).toBeNull();
    expect(postAlert).not.toHaveBeenCalled();
  });
});
