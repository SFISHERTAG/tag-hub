import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Story 5.6 AC5: submitting the same campaign creation twice must return the
 * same campaignId both times, not create two campaigns. Real Meta API calls
 * are out of scope for a unit test (5.6 has no ad account to call against
 * safely) — the Marketing API client is faked here so the assertion is on
 * the idempotency guard itself: given identical (locationId, templateId,
 * formInputs), the second call must resolve from the Firestore-recorded
 * state instead of issuing a second POST /campaigns.
 */

type FakeDoc = { data: Record<string, unknown> | undefined };

function makeFakeFirestore() {
  const docs = new Map<string, FakeDoc>();

  const doc = (path: string) => ({
    async get() {
      const found = docs.get(path);
      return { exists: !!found, data: () => found?.data };
    },
    async create(data: Record<string, unknown>) {
      if (docs.has(path)) {
        const err = new Error("ALREADY_EXISTS: document already exists") as Error & { code?: number };
        err.code = 6;
        throw err;
      }
      docs.set(path, { data });
    },
    async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
      const existing = docs.get(path)?.data ?? {};
      docs.set(path, { data: opts?.merge ? { ...existing, ...data } : data });
    },
  });

  return {
    collection(name: string) {
      return { doc: (id: string) => doc(`${name}/${id}`) };
    },
  };
}

vi.mock("@/lib/firestore", () => {
  const fake = makeFakeFirestore();
  return { firestore: () => fake };
});

vi.mock("@/lib/ghl/tenants", () => ({
  getTenant: async (locationId: string) => ({
    locationId,
    name: "Test Client",
    services: {
      vslFunnel: false,
      adManagement: true,
      closingTeam: false,
      website: false,
      salesEnablement: false,
    },
    ownerModel: "client",
    metaAdAccountId: "act_999",
  }),
}));

vi.mock("@/lib/audit/store", () => ({
  logAction: async () => "audit-doc-id",
}));

const metaCallMock = vi.fn();
let nextId = 1;

vi.mock("@/lib/meta/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/meta/client")>("@/lib/meta/client");
  return {
    ...actual,
    isMetaConfigured: () => true,
    getMetaApi: () => ({
      call: metaCallMock,
    }),
  };
});

describe("createPausedCampaign idempotency (Story 5.6 AC5)", () => {
  beforeEach(() => {
    metaCallMock.mockReset();
    nextId = 1;
    metaCallMock.mockImplementation(async (_method: string, path: string) => {
      const id = `${path.includes("campaigns") ? "cmp" : path.includes("adsets") ? "adset" : "ad"}_${nextId++}`;
      return { id };
    });
  });

  it("returns the same campaignId on a duplicate submission instead of creating a second campaign", async () => {
    const { createPausedCampaign } = await import("@/lib/onboarding/campaign-launch");

    const formInputs = {
      clientName: "Acme Tax",
      offerId: "tax-return-prep",
      monthlyBudget: 1500,
      dailyCap: 40,
      pixelId: "pixel-123",
    };

    const first = await createPausedCampaign("loc_1", "tax-return-prep", formInputs);
    const second = await createPausedCampaign("loc_1", "tax-return-prep", formInputs);

    expect(second.campaignId).toBe(first.campaignId);
    expect(second.adSetId).toBe(first.adSetId);
    expect(second.adIds).toEqual(first.adIds);

    const campaignCreateCalls = metaCallMock.mock.calls.filter(([, path]) => path === "/act_999/campaigns");
    expect(campaignCreateCalls).toHaveLength(1);
  });

  it("rejects a request over the offer's budget ceiling without calling Meta", async () => {
    const { createPausedCampaign } = await import("@/lib/onboarding/campaign-launch");

    await expect(
      createPausedCampaign("loc_2", "tax-return-prep", {
        clientName: "Over Budget Co",
        offerId: "tax-return-prep",
        monthlyBudget: 999999,
        dailyCap: 100,
        pixelId: "pixel-456",
      }),
    ).rejects.toThrow(/exceeds the \$2000\/mo ceiling/);

    expect(metaCallMock).not.toHaveBeenCalled();
  });
});
