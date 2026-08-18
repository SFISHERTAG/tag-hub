import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

/**
 * Same gap as phase1/phase2, on the Meta setup handler: no signature check
 * meant a handcrafted POST could trigger a real email to a client
 * ("grant access to your ad account...") and a Slack post, plus writes to
 * Firestore/Postgres. This checks the rejection path - missing/invalid
 * x-ghl-signature must 401 before any of that fires.
 */

const saveTenantResources = vi.fn();
const logProvisioningEvent = vi.fn();
vi.mock("../firestore", () => ({
  saveTenantResources: (...args: unknown[]) => saveTenantResources(...args),
  logProvisioningEvent: (...args: unknown[]) => logProvisioningEvent(...args),
}));

const sendMetaAccessRequest = vi.fn();
const sendMetaSetupGuide = vi.fn();
vi.mock("../email", () => ({
  sendMetaAccessRequest: (...args: unknown[]) => sendMetaAccessRequest(...args),
  sendMetaSetupGuide: (...args: unknown[]) => sendMetaSetupGuide(...args),
}));

const postMessage = vi.fn();
vi.mock("../slack", () => ({
  postMessage: (...args: unknown[]) => postMessage(...args),
}));

const logAutomationEvent = vi.fn();
const logMetaSetup = vi.fn();
vi.mock("../postgres", () => ({
  logAutomationEvent: (...args: unknown[]) => logAutomationEvent(...args),
  logMetaSetup: (...args: unknown[]) => logMetaSetup(...args),
}));

const { handlePhase3 } = await import("./phase3-meta-setup");

const validBody = {
  locationId: "loc_1",
  email: "owner@acme.com",
  intakeData: { metaAdAccountId: "act_123" },
  slackChannelId: "C123",
};

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return {
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
    headers,
  } as unknown as Request;
}

function makeRes() {
  const res = {
    statusCode: 200 as number,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GHL_WEBHOOK_HMAC_SECRET = "test-secret";
});

describe("handlePhase3 signature verification", () => {
  it("rejects a request with no signature header and runs no provisioning side effects", async () => {
    const req = makeReq(validBody);
    const res = makeRes();

    await handlePhase3(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or missing webhook signature" });

    expect(sendMetaAccessRequest).not.toHaveBeenCalled();
    expect(sendMetaSetupGuide).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
    expect(saveTenantResources).not.toHaveBeenCalled();
    expect(logProvisioningEvent).not.toHaveBeenCalled();
    expect(logAutomationEvent).not.toHaveBeenCalled();
    expect(logMetaSetup).not.toHaveBeenCalled();
  });

  it("rejects a request with a wrong signature and runs no provisioning side effects", async () => {
    const req = makeReq(validBody, { "x-ghl-signature": "0".repeat(64) });
    const res = makeRes();

    await handlePhase3(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(sendMetaAccessRequest).not.toHaveBeenCalled();
    expect(logAutomationEvent).not.toHaveBeenCalled();
  });
});
