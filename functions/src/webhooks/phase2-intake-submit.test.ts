import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

/**
 * Same gap as phase1, on the intake-submission handler: no signature check
 * meant a handcrafted POST could trigger Gemini content generation, a real
 * Google Doc creation/share, and a Phase 3 trigger. This checks the
 * rejection path - missing/invalid x-ghl-signature must 401 before any of
 * that fires.
 */

const createGoogleDoc = vi.fn();
const shareGoogleDoc = vi.fn();
const addDocTab = vi.fn();
vi.mock("../google", () => ({
  createGoogleDoc: (...args: unknown[]) => createGoogleDoc(...args),
  shareGoogleDoc: (...args: unknown[]) => shareGoogleDoc(...args),
  addDocTab: (...args: unknown[]) => addDocTab(...args),
}));

const saveIntakeSubmission = vi.fn();
const logProvisioningEvent = vi.fn();
const saveTenantResources = vi.fn();
vi.mock("../firestore", () => ({
  saveIntakeSubmission: (...args: unknown[]) => saveIntakeSubmission(...args),
  logProvisioningEvent: (...args: unknown[]) => logProvisioningEvent(...args),
  saveTenantResources: (...args: unknown[]) => saveTenantResources(...args),
}));

const generateAllContent = vi.fn();
vi.mock("../gemini", () => ({
  generateAllContent: (...args: unknown[]) => generateAllContent(...args),
}));

const logAutomationEvent = vi.fn();
vi.mock("../postgres", () => ({
  logAutomationEvent: (...args: unknown[]) => logAutomationEvent(...args),
}));

const { handlePhase2 } = await import("./phase2-intake-submit");

const validBody = {
  locationId: "loc_1",
  email: "owner@acme.com",
  intakeData: { businessName: "Acme Co" },
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

describe("handlePhase2 signature verification", () => {
  it("rejects a request with no signature header and runs no provisioning side effects", async () => {
    const req = makeReq(validBody);
    const res = makeRes();

    await handlePhase2(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or missing webhook signature" });

    expect(saveIntakeSubmission).not.toHaveBeenCalled();
    expect(generateAllContent).not.toHaveBeenCalled();
    expect(createGoogleDoc).not.toHaveBeenCalled();
    expect(addDocTab).not.toHaveBeenCalled();
    expect(shareGoogleDoc).not.toHaveBeenCalled();
    expect(saveTenantResources).not.toHaveBeenCalled();
    expect(logProvisioningEvent).not.toHaveBeenCalled();
    expect(logAutomationEvent).not.toHaveBeenCalled();
  });

  it("rejects a request with a wrong signature and runs no provisioning side effects", async () => {
    const req = makeReq(validBody, { "x-ghl-signature": "0".repeat(64) });
    const res = makeRes();

    await handlePhase2(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(saveIntakeSubmission).not.toHaveBeenCalled();
    expect(generateAllContent).not.toHaveBeenCalled();
  });
});
