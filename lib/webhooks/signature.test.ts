import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyHmacSignature } from "./signature";

describe("verifyHmacSignature", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ eventId: "evt_123", type: "appointment.updated" });
  const validSignature = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a correctly signed body", () => {
    expect(verifyHmacSignature(body, validSignature, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tamperedBody = JSON.stringify({ eventId: "evt_123", type: "appointment.deleted" });
    expect(verifyHmacSignature(tamperedBody, validSignature, secret)).toBe(false);
  });

  it("rejects the right signature computed with the wrong secret", () => {
    const wrongSecretSignature = createHmac("sha256", "wrong-secret").update(body).digest("hex");
    expect(verifyHmacSignature(body, wrongSecretSignature, secret)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyHmacSignature(body, null, secret)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(verifyHmacSignature(body, "too-short", secret)).toBe(false);
  });
});
