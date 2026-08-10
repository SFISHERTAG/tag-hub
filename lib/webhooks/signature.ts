import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an HMAC-SHA256 webhook signature against the raw request body.
 *
 * Takes the raw body string, not a parsed object — signatures are computed
 * over exact bytes, and re-serializing a parsed JSON object is not
 * guaranteed to match what the sender signed (key order, whitespace).
 * Always read the body as text before parsing it, for this reason.
 *
 * Timing-safe compare: a naive `===` on the two hex strings leaks how many
 * leading bytes matched through response timing, letting an attacker guess
 * a valid signature byte-by-byte. `timingSafeEqual` takes constant time
 * regardless of where the mismatch is.
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
