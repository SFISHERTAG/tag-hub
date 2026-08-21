import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: the intake-submit chain (client form / GHL webhook / admin trigger,
 * all proxied through the app) can retry on a slow response. Without the
 * guard added in Phase 2 item 2.1, a retry re-generates Gemini content,
 * re-creates the Google Doc, and re-shares it with the client.
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

const createGoogleDoc = vi.fn(async (..._args: unknown[]) => "doc-1");
const shareGoogleDoc = vi.fn(async (..._args: unknown[]) => undefined);
const addDocTab = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("../google", () => ({
  createGoogleDoc: (...args: unknown[]) => createGoogleDoc(...args),
  shareGoogleDoc: (...args: unknown[]) => shareGoogleDoc(...args),
  addDocTab: (...args: unknown[]) => addDocTab(...args),
}));

const saveIntakeSubmission = vi.fn(async (..._args: unknown[]) => undefined);
const logProvisioningEvent = vi.fn(async (..._args: unknown[]) => undefined);
const saveTenantResources = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("../firestore", () => ({
  saveIntakeSubmission: (...args: unknown[]) => saveIntakeSubmission(...args),
  logProvisioningEvent: (...args: unknown[]) => logProvisioningEvent(...args),
  saveTenantResources: (...args: unknown[]) => saveTenantResources(...args),
}));

const generateAllContent = vi.fn(async (..._args: unknown[]) => ({
  uvp: "uvp",
  adCopy: "ad copy",
  preCallScript: "script",
  projectCharter: "charter",
}));
vi.mock("../gemini", () => ({
  generateAllContent: (...args: unknown[]) => generateAllContent(...args),
}));

const logAutomationEvent = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("../postgres", () => ({
  logAutomationEvent: (...args: unknown[]) => logAutomationEvent(...args),
}));

const { handlePhase2 } = await import("./phase2-intake-submit");

function fakeReqRes(body: unknown) {
  const req = { body, header: () => undefined } as unknown as Parameters<typeof handlePhase2>[0];
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { json, status } as unknown as Parameters<typeof handlePhase2>[1];
  return { req, res, json, status };
}

beforeEach(() => {
  vi.clearAllMocks();
  stores.clear();
  // The tenant lookup inside handlePhase2 reads this doc directly via a raw
  // Firestore client, keyed by locationId, not through ../firestore.
  stores.set("locations", new Map([["loc-abc", { driveFolderId: "folder-1", name: "Acme Inc", slackChannelId: "ch-1" }]]));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (..._args: unknown[]) => ({ ok: true, json: async () => ({ status: "ok" }) })),
  );
  process.env.PHASE3_WEBHOOK_URL = "https://example.test/webhook/phase3";
});

describe("handlePhase2 idempotency", () => {
  const payload = {
    locationId: "loc-abc",
    email: "client@acme.test",
    intakeData: { businessName: "Acme Inc" },
  };

  it("processes a delivery once and short-circuits an identical retry", async () => {
    const first = fakeReqRes(payload);
    await handlePhase2(first.req, first.res);

    expect(createGoogleDoc).toHaveBeenCalledTimes(1);
    expect(shareGoogleDoc).toHaveBeenCalledTimes(1);
    expect(first.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

    const second = fakeReqRes(payload);
    await handlePhase2(second.req, second.res);

    expect(createGoogleDoc).toHaveBeenCalledTimes(1);
    expect(shareGoogleDoc).toHaveBeenCalledTimes(1);
    expect(second.json).toHaveBeenCalledWith({ success: true, duplicate: true });
  });

  it("releases the claim on failure so a later retry can actually retry", async () => {
    createGoogleDoc.mockRejectedValueOnce(new Error("Drive API down"));

    const first = fakeReqRes(payload);
    await handlePhase2(first.req, first.res);
    expect(first.status).toHaveBeenCalledWith(500);

    const second = fakeReqRes(payload);
    await handlePhase2(second.req, second.res);

    expect(createGoogleDoc).toHaveBeenCalledTimes(2);
    expect(second.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
