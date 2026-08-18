import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: Phase 3 is reachable both from Phase 2's own auto-trigger and from
 * app/api/onboarding/phase3-meta-setup's manual trigger, either of which can
 * retry on a slow response. Without the guard added in Phase 2 item 2.1, a
 * retry re-sends the client-facing setup-guide email.
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

const saveTenantResources = vi.fn(async () => undefined);
const logProvisioningEvent = vi.fn(async () => undefined);
vi.mock("../firestore", () => ({
  saveTenantResources: (...args: unknown[]) => saveTenantResources(...args),
  logProvisioningEvent: (...args: unknown[]) => logProvisioningEvent(...args),
}));

const sendMetaAccessRequest = vi.fn(async () => undefined);
const sendMetaSetupGuide = vi.fn(async () => undefined);
vi.mock("../email", () => ({
  sendMetaAccessRequest: (...args: unknown[]) => sendMetaAccessRequest(...args),
  sendMetaSetupGuide: (...args: unknown[]) => sendMetaSetupGuide(...args),
}));

const postMessage = vi.fn(async () => undefined);
vi.mock("../slack", () => ({
  postMessage: (...args: unknown[]) => postMessage(...args),
}));

const logAutomationEvent = vi.fn(async () => undefined);
const logMetaSetup = vi.fn(async () => undefined);
vi.mock("../postgres", () => ({
  logAutomationEvent: (...args: unknown[]) => logAutomationEvent(...args),
  logMetaSetup: (...args: unknown[]) => logMetaSetup(...args),
}));

const { handlePhase3 } = await import("./phase3-meta-setup");

function fakeReqRes(body: unknown) {
  const req = { body, header: () => undefined } as unknown as Parameters<typeof handlePhase3>[0];
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { json, status } as unknown as Parameters<typeof handlePhase3>[1];
  return { req, res, json, status };
}

beforeEach(() => {
  vi.clearAllMocks();
  stores.clear();
});

describe("handlePhase3 idempotency", () => {
  // No metaAdAccountId — takes the simpler "send setup guide" branch.
  const payload = {
    locationId: "loc-abc",
    email: "client@acme.test",
    intakeData: { businessName: "Acme Inc" },
  };

  it("processes a delivery once and short-circuits an identical retry", async () => {
    const first = fakeReqRes(payload);
    await handlePhase3(first.req, first.res);

    expect(sendMetaSetupGuide).toHaveBeenCalledTimes(1);
    expect(first.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

    const second = fakeReqRes(payload);
    await handlePhase3(second.req, second.res);

    expect(sendMetaSetupGuide).toHaveBeenCalledTimes(1);
    expect(second.json).toHaveBeenCalledWith({ success: true, duplicate: true });
  });

  it("releases the claim on failure so a later retry can actually retry, and doesn't crash logging the error", async () => {
    sendMetaSetupGuide.mockRejectedValueOnce(new Error("Mailer down"));

    const first = fakeReqRes(payload);
    await handlePhase3(first.req, first.res);
    expect(first.status).toHaveBeenCalledWith(500);
    // The pre-existing bug this touched: `locationId` referenced in the catch
    // block was out of scope, throwing before logAutomationEvent could run.
    expect(logAutomationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc-abc", event: "phase3_error" }),
    );

    const second = fakeReqRes(payload);
    await handlePhase3(second.req, second.res);

    expect(sendMetaSetupGuide).toHaveBeenCalledTimes(2);
    expect(second.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
