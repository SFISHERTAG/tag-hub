import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

/**
 * Verify an HMAC-SHA256 webhook signature against the raw request body.
 *
 * Mirrors lib/webhooks/signature.ts exactly (same algorithm, same
 * timing-safe comparison against a hex digest). functions/ builds as its
 * own standalone TypeScript project (own tsconfig with rootDir "./src",
 * own package.json, own node_modules) and cannot import across that
 * boundary: tsc rejects a relative import that reaches outside
 * functions/src with "File is not under 'rootDir'" (TS6059). This is kept
 * in sync by hand with the canonical copy in lib/webhooks/signature.ts -
 * if you change the algorithm there, change it here too.
 */
export function verifyHmacSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");

  // Different lengths would throw inside timingSafeEqual rather than just
  // returning false, so check that up front.
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verify that an incoming GHL webhook request carries a valid HMAC
 * signature, computed over the raw bytes captured on `req.rawBody` (see
 * index.ts's express.json `verify` hook for the local/dev path; the Cloud
 * Functions Framework populates the same field automatically for deployed
 * HTTP functions). Never verify against req.body - re-serializing the
 * parsed object is not guaranteed to match the exact bytes GHL signed.
 *
 * Header name assumption: GHL's "Webhook" workflow action (what triggers
 * phase1/2/3) has no documented signature convention of its own - that's
 * distinct from GHL's Marketplace App webhooks, which use a different,
 * RSA-based scheme these endpoints don't receive. Absent an established
 * convention, this expects a custom header named `x-ghl-signature`,
 * configured on the GHL workflow action, carrying the hex HMAC-SHA256
 * digest of the raw request body. If GHL's workflow action can't compute
 * an HMAC itself, this same header can be populated by a thin relay in
 * front of these functions - either way, the header name and secret here
 * are what must match on the sending side.
 */
export function verifyGhlWebhookRequest(req: Request): boolean {
  const secret = process.env.GHL_WEBHOOK_HMAC_SECRET;
  if (!secret) {
    console.error("[Webhook] GHL_WEBHOOK_HMAC_SECRET is not set; rejecting request");
    return false;
  }

  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : "";
  const signatureHeader = req.headers["x-ghl-signature"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : (signatureHeader ?? null);

  return verifyHmacSignature(rawBody, signature, secret);
}
