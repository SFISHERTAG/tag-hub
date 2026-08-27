import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/session";
import { ROLES, ROLE_LIST } from "@/lib/auth/roles";

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


/**
 * The six roles the alert never reached.
 *
 * getLocationForDashboard routed on isInternalUser (four TAG-side roles) and
 * isClientUser (three client roles), which between them name seven of the
 * thirteen in ROLES. The other six fell to a third exit that RETURNED rather
 * than threw:
 *
 *   return locations[0] || process.env.GHL_LOCATION_ID || "";
 *
 * So admin, tag_csd, tag_setter_manager, tag_setter, client_setter_manager and
 * client_setter never produced a DashboardLocationError, never reached
 * resolveDashboardLocation's catch, and never escalated. Story 8.7 marked AC1
 * satisfied while it was true for seven roles out of thirteen.
 */
const FELL_THROUGH_INTERNAL = [
  ROLES.ADMIN,
  ROLES.TAG_CSD,
  ROLES.TAG_SETTER_MANAGER,
  ROLES.TAG_SETTER,
] as const;

const FELL_THROUGH_CLIENT = [ROLES.CLIENT_SETTER_MANAGER, ROLES.CLIENT_SETTER] as const;

describe("every role reaches a typed branch", () => {
  it("is exercising a role list that is actually populated", () => {
    // Standing order 2: a loop over an empty list asserts nothing.
    expect(ROLE_LIST.length).toBe(13);
  });

  for (const role of FELL_THROUGH_INTERNAL) {
    it(`escalates for ${role}, which previously fell through silently`, async () => {
      vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const resolve = await load();

      expect(resolve(session({ currentRole: role, availableRoles: [role] }))).toBeNull();
      expect(postAlert).toHaveBeenCalledTimes(1);
      expect(postAlert.mock.calls[0]?.[0]).toContain("GHL_LOCATION_ID_TAG_GROWTH");
    });

    it(`serves ${role} the agency location once it is configured`, async () => {
      vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "loc_agency");
      const resolve = await load();

      expect(resolve(session({ currentRole: role, availableRoles: [role] }))).toBe("loc_agency");
      expect(postAlert).not.toHaveBeenCalled();
    });
  }

  for (const role of FELL_THROUGH_CLIENT) {
    it(`treats ${role} as a client with no location, quietly`, async () => {
      const resolve = await load();

      expect(resolve(session({ currentRole: role, availableRoles: [role] }))).toBeNull();
      expect(postAlert).not.toHaveBeenCalled();
    });

    it(`never hands ${role} the legacy tenant when it has no location of its own`, async () => {
      // The sharper half of the same defect, and worse than the missing alert.
      // Under the old fallback a client setter with no assigned location got
      // `locations[0] || process.env.GHL_LOCATION_ID`, and GHL_LOCATION_ID is
      // set in production (cloudbuild.yaml). So an unassigned client-side user
      // was served another tenant's location id, silently, with no alert. This
      // is the case that must resolve to null rather than to somebody else.
      vi.stubEnv("GHL_LOCATION_ID", "loc_legacy_tenant");
      const resolve = await load();

      expect(resolve(session({ currentRole: role, availableRoles: [role] }))).toBeNull();
      expect(postAlert).not.toHaveBeenCalled();
    });

    it(`serves ${role} its own assigned location`, async () => {
      const resolve = await load();

      expect(
        resolve(session({ currentRole: role, availableRoles: [role], locations: ["loc_client"] })),
      ).toBe("loc_client");
    });
  }

  it("consults GHL_LOCATION_ID for nobody, which is the whole defect", async () => {
    // The regression pin. GHL_LOCATION_ID names the PIT's own sub-account
    // (lib/ghl/tokens.ts) and is set in production (cloudbuild.yaml). While it
    // was the fallback, an admin with the agency location unset silently got
    // the legacy single tenant and nothing alerted. Stories 1.3 and 1.5 both
    // say this variable must not decide what a signed-in user sees.
    vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "");
    vi.stubEnv("GHL_LOCATION_ID", "loc_legacy_tenant");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resolve = await load();

    expect(resolve(session({ currentRole: ROLES.ADMIN, availableRoles: [ROLES.ADMIN] }))).not.toBe(
      "loc_legacy_tenant",
    );
    expect(postAlert).toHaveBeenCalledTimes(1);
  });

  it("leaves no role on a silent path: each is agency, assigned, or a typed fault", async () => {
    vi.stubEnv("GHL_LOCATION_ID_TAG_GROWTH", "loc_agency");
    vi.stubEnv("GHL_LOCATION_ID", "loc_legacy_tenant");
    const resolve = await load();

    for (const role of ROLE_LIST) {
      const resolved = resolve(session({ currentRole: role, availableRoles: [role] }));
      // No location on the session, so a client role must resolve to null and
      // an internal one to the agency location. Neither may be the legacy
      // tenant, which is what the removed fallback would have produced.
      expect(resolved === null || resolved === "loc_agency").toBe(true);
    }
  });
});
