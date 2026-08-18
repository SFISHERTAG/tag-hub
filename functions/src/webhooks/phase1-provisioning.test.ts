import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

/**
 * Covers the gap the audit flagged: phase1Provisioning had zero signature
 * verification, so anyone who found the URL could trigger a full client
 * provisioning run (GHL clone, Slack channel, Drive folder, emails) with a
 * handcrafted POST. This checks the rejection path only - a request with no
 * (or an invalid) x-ghl-signature header must 401 before any provisioning
 * side effect fires, never fall through to "missing field" validation or the
 * provisioning steps themselves.
 */

const cloneLocation = vi.fn();
const findLocationByName = vi.fn();
const createOpportunity = vi.fn();
const getPipelines = vi.fn();
vi.mock("../ghl", () => ({
  cloneLocation: (...args: unknown[]) => cloneLocation(...args),
  findLocationByName: (...args: unknown[]) => findLocationByName(...args),
  createOpportunity: (...args: unknown[]) => createOpportunity(...args),
  getPipelines: (...args: unknown[]) => getPipelines(...args),
}));

const createSlackChannel = vi.fn();
const inviteSlackGuest = vi.fn();
vi.mock("../slack", () => ({
  createSlackChannel: (...args: unknown[]) => createSlackChannel(...args),
  inviteSlackGuest: (...args: unknown[]) => inviteSlackGuest(...args),
}));

const createDriveFolder = vi.fn();
vi.mock("../google", () => ({
  createDriveFolder: (...args: unknown[]) => createDriveFolder(...args),
}));

const addToOtpWhitelist = vi.fn();
const saveTenantResources = vi.fn();
const logProvisioningEvent = vi.fn();
vi.mock("../firestore", () => ({
  addToOtpWhitelist: (...args: unknown[]) => addToOtpWhitelist(...args),
  saveTenantResources: (...args: unknown[]) => saveTenantResources(...args),
  logProvisioningEvent: (...args: unknown[]) => logProvisioningEvent(...args),
}));

const sendIntakeFormEmail = vi.fn();
const sendProvisioningConfirmation = vi.fn();
vi.mock("../email", () => ({
  sendIntakeFormEmail: (...args: unknown[]) => sendIntakeFormEmail(...args),
  sendProvisioningConfirmation: (...args: unknown[]) => sendProvisioningConfirmation(...args),
}));

const { handlePhase1 } = await import("./phase1-provisioning");

const validBody = {
  opportunity: { id: "opp_1", name: "Acme Co", stage: "Closed Won" },
  contact: { id: "contact_1", name: "Acme Co", email: "owner@acme.com" },
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

describe("handlePhase1 signature verification", () => {
  it("rejects a request with no signature header and runs no provisioning side effects", async () => {
    const req = makeReq(validBody);
    const res = makeRes();

    await handlePhase1(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or missing webhook signature" });

    expect(cloneLocation).not.toHaveBeenCalled();
    expect(findLocationByName).not.toHaveBeenCalled();
    expect(createOpportunity).not.toHaveBeenCalled();
    expect(createSlackChannel).not.toHaveBeenCalled();
    expect(inviteSlackGuest).not.toHaveBeenCalled();
    expect(createDriveFolder).not.toHaveBeenCalled();
    expect(addToOtpWhitelist).not.toHaveBeenCalled();
    expect(saveTenantResources).not.toHaveBeenCalled();
    expect(sendIntakeFormEmail).not.toHaveBeenCalled();
    expect(sendProvisioningConfirmation).not.toHaveBeenCalled();
  });

  it("rejects a request with a wrong signature and runs no provisioning side effects", async () => {
    const req = makeReq(validBody, { "x-ghl-signature": "0".repeat(64) });
    const res = makeRes();

    await handlePhase1(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(cloneLocation).not.toHaveBeenCalled();
    expect(saveTenantResources).not.toHaveBeenCalled();
  });

  it("rejects every request when the shared secret isn't configured, even with a signature header present", async () => {
    delete process.env.GHL_WEBHOOK_HMAC_SECRET;
    const req = makeReq(validBody, { "x-ghl-signature": "anything" });
    const res = makeRes();

    await handlePhase1(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(cloneLocation).not.toHaveBeenCalled();
  });
});
