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

function fakeReqRes(body: unknown) {
  const req = { body, header: () => undefined } as unknown as Parameters<typeof handlePhase1>[0];
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { json, status } as unknown as Parameters<typeof handlePhase1>[1];
  return { req, res, json, status };
}

beforeEach(() => {
  vi.clearAllMocks();
  stores.clear();
  process.env.TAG_SHARED_DRIVE_ID = "shared-drive-1";
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
});
