import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: GHL retries this webhook on a slow response. Without the guard added
 * in Phase 2 item 2.1, a retry re-clones the GHL location, re-creates the
 * Slack channel/Drive folder, and re-sends the intake email. This test drives
 * the handler twice with the identical delivery and asserts the second call
 * is a no-op that still returns success (so GHL stops retrying).
 */

const { stores } = vi.hoisted(() => ({ stores: new Map<string, Map<string, unknown>>() }));

vi.mock("@google-cloud/firestore", () => {
  class FakeDoc {
    constructor(
      private store: Map<string, unknown>,
      private key: string,
    ) {}
    async get() {
      const data = this.store.get(this.key);
      return { exists: this.store.has(this.key), data: () => data };
    }
    async create(data: unknown) {
      if (this.store.has(this.key)) throw new Error("ALREADY_EXISTS");
      this.store.set(this.key, data);
    }
    async delete() {
      this.store.delete(this.key);
    }
  }
  class FakeCollection {
    constructor(private store: Map<string, unknown>) {}
    doc(key: string) {
      return new FakeDoc(this.store, key);
    }
  }
  class Firestore {
    collection(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      return new FakeCollection(stores.get(name)!);
    }
  }
  return { Firestore };
});

const cloneLocation = vi.fn(async (..._args: unknown[]) => "loc-123");
const findLocationByName = vi.fn(async (..._args: unknown[]) => "template-loc");
const createOpportunity = vi.fn(async (..._args: unknown[]) => "opp-999");
const getPipelines = vi.fn(async (..._args: unknown[]) => [{ id: "pipe-1", name: "Fulfillment" }]);

vi.mock("../ghl", () => ({
  cloneLocation: (...args: unknown[]) => cloneLocation(...args),
  findLocationByName: (...args: unknown[]) => findLocationByName(...args),
  createOpportunity: (...args: unknown[]) => createOpportunity(...args),
  getPipelines: (...args: unknown[]) => getPipelines(...args),
}));

const createSlackChannel = vi.fn(async (..._args: unknown[]) => "channel-1");
const inviteSlackGuest = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("../slack", () => ({
  createSlackChannel: (...args: unknown[]) => createSlackChannel(...args),
  inviteSlackGuest: (...args: unknown[]) => inviteSlackGuest(...args),
}));

const createDriveFolder = vi.fn(async (..._args: unknown[]) => "folder-1");
vi.mock("../google", () => ({
  createDriveFolder: (...args: unknown[]) => createDriveFolder(...args),
}));

const addToOtpWhitelist = vi.fn(async (..._args: unknown[]) => undefined);
const saveTenantResources = vi.fn(async (..._args: unknown[]) => undefined);
const logProvisioningEvent = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("../firestore", () => ({
  addToOtpWhitelist: (...args: unknown[]) => addToOtpWhitelist(...args),
  saveTenantResources: (...args: unknown[]) => saveTenantResources(...args),
  logProvisioningEvent: (...args: unknown[]) => logProvisioningEvent(...args),
}));

const sendIntakeFormEmail = vi.fn(async (..._args: unknown[]) => undefined);
const sendProvisioningConfirmation = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("../email", () => ({
  sendIntakeFormEmail: (...args: unknown[]) => sendIntakeFormEmail(...args),
  sendProvisioningConfirmation: (...args: unknown[]) => sendProvisioningConfirmation(...args),
}));

const { handlePhase1 } = await import("./phase1-provisioning");

const WEBHOOK_SECRET = "phase1-test-secret";

/**
 * Phase 1 now rejects a call without a valid bearer token — the endpoint
 * writes into the OTP whitelist, so it authenticates rather than warns.
 * These are idempotency tests, so they send a valid token; the auth
 * behaviour has its own cases below.
 */
// `null` means "send no Authorization header at all" — an explicit
// `undefined` would fall back to the default parameter instead.
function fakeReqRes(body: unknown, authorization: string | null = `Bearer ${WEBHOOK_SECRET}`) {
  const req = {
    body,
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? (authorization ?? undefined) : undefined,
  } as unknown as Parameters<typeof handlePhase1>[0];
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { json, status } as unknown as Parameters<typeof handlePhase1>[1];
  return { req, res, json, status };
}

beforeEach(() => {
  vi.clearAllMocks();
  stores.clear();
  process.env.TAG_SHARED_DRIVE_ID = "shared-drive-1";
  process.env.PHASE1_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

describe("handlePhase1 idempotency", () => {
  const payload = {
    opportunity: { id: "opp-abc", name: "Acme Deal" },
    contact: { name: "Acme Inc", email: "client@acme.test" },
  };

  it("processes a delivery once and short-circuits an identical retry", async () => {
    const first = fakeReqRes(payload);
    await handlePhase1(first.req, first.res);

    expect(cloneLocation).toHaveBeenCalledTimes(1);
    expect(createSlackChannel).toHaveBeenCalledTimes(1);
    expect(createDriveFolder).toHaveBeenCalledTimes(1);
    expect(first.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

    const second = fakeReqRes(payload);
    await handlePhase1(second.req, second.res);

    // No re-provisioning on the retried delivery.
    expect(cloneLocation).toHaveBeenCalledTimes(1);
    expect(createSlackChannel).toHaveBeenCalledTimes(1);
    expect(createDriveFolder).toHaveBeenCalledTimes(1);
    expect(sendIntakeFormEmail).toHaveBeenCalledTimes(1);
    expect(second.json).toHaveBeenCalledWith({ success: true, duplicate: true });
  });

  it("releases the claim on failure so a later retry can actually retry", async () => {
    cloneLocation.mockRejectedValueOnce(new Error("GHL API down"));

    const first = fakeReqRes(payload);
    await handlePhase1(first.req, first.res);
    expect(first.status).toHaveBeenCalledWith(500);

    const second = fakeReqRes(payload);
    await handlePhase1(second.req, second.res);

    // The failed attempt didn't count as "processed" — the retry actually runs.
    expect(cloneLocation).toHaveBeenCalledTimes(2);
    expect(second.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("holds the claim when the failure lands after resources already exist", async () => {
    // The cascade this closes: a throw at any step past the GHL clone used to
    // release the claim, so GHL's retry cloned a second sub-account, opened a
    // second Slack channel and Drive folder, and re-sent the intake email for
    // the same client. None of those are rollback-able and none are
    // idempotent, so the claim is held and a human finishes the run.
    sendIntakeFormEmail.mockRejectedValueOnce(new Error("Mailer down"));

    const first = fakeReqRes(payload);
    await handlePhase1(first.req, first.res);

    expect(first.status).toHaveBeenCalledWith(500);
    expect(first.json).toHaveBeenCalledWith(
      expect.objectContaining({
        partial: true,
        created: expect.objectContaining({ ghlLocationId: "loc-123", slackChannelId: "channel-1" }),
      }),
    );

    const second = fakeReqRes(payload);
    await handlePhase1(second.req, second.res);

    // The retry must not re-provision anything.
    expect(cloneLocation).toHaveBeenCalledTimes(1);
    expect(createSlackChannel).toHaveBeenCalledTimes(1);
    expect(createDriveFolder).toHaveBeenCalledTimes(1);
    expect(second.json).toHaveBeenCalledWith({ success: true, duplicate: true });
  });
});

describe("handlePhase1 authentication", () => {
  const validBody = {
    opportunity: { id: "opp-auth", name: "Auth Co" },
    contact: { name: "Auth Co", email: "owner@authco.test" },
  };

  it("rejects a call with no bearer token before doing any provisioning", async () => {
    const { req, res, json, status } = fakeReqRes(validBody, null);
    await handlePhase1(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Unauthorized." });
    // The whole point: the OTP whitelist write must not have happened.
    expect(addToOtpWhitelist).not.toHaveBeenCalled();
    expect(cloneLocation).not.toHaveBeenCalled();
  });

  it("rejects a mismatched token", async () => {
    const { req, res, status } = fakeReqRes(validBody, "Bearer not-the-secret");
    await handlePhase1(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(addToOtpWhitelist).not.toHaveBeenCalled();
  });

  it("fails closed with a 500 when the secret is not configured", async () => {
    // A half-finished deploy takes the endpoint offline rather than leaving
    // it open, which is the failure mode this check exists to prevent.
    delete process.env.PHASE1_WEBHOOK_SECRET;
    const { req, res, status } = fakeReqRes(validBody);
    await handlePhase1(req, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(addToOtpWhitelist).not.toHaveBeenCalled();
  });
});
