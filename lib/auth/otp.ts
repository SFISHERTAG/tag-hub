import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Firestore, Timestamp } from "@google-cloud/firestore";

/**
 * Six-digit email one-time passcodes.
 *
 * Codes are stored hashed, never in plaintext: a Firestore reader — a backup, a
 * console session, an over-broad IAM grant — must not be able to sign in as
 * anyone.
 *
 * Every guard here exists because a 6-digit code is only a million
 * possibilities. Without an attempt cap that is a few minutes of brute force,
 * so expiry, attempt limits, and single use are what make the length safe.
 */

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

let db: Firestore | null = null;
function firestore(): Firestore {
  if (!db) {
    db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "tag-success-hub",
      ignoreUndefinedProperties: true,
    });
  }
  return db;
}

/** Email is the document id, so normalise it the same way every time. */
function key(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function hashCode(email: string, code: string): string {
  // Binding the hash to the email stops a code issued for one address being
  // replayed against another.
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}

function doc(email: string) {
  return firestore().doc(`authCodes/${key(email)}`);
}

export type RequestOutcome =
  | { sent: true; code: string; expiresAt: number }
  | { sent: false; reason: "cooldown"; retryAfterMs: number };

/**
 * Issues a code. Returns it so the caller can deliver it — this module does not
 * send email, so the delivery mechanism stays swappable.
 */
export async function issueCode(email: string): Promise<RequestOutcome> {
  const ref = doc(email);
  const existing = await ref.get();

  if (existing.exists) {
    const data = existing.data()!;
    const issuedAt = (data.issuedAt as Timestamp | undefined)?.toMillis() ?? 0;
    const sinceLast = Date.now() - issuedAt;
    if (sinceLast < RESEND_COOLDOWN_MS) {
      return {
        sent: false,
        reason: "cooldown",
        retryAfterMs: RESEND_COOLDOWN_MS - sinceLast,
      };
    }
  }

  // randomInt is drawn from a CSPRNG. Math.random is not, and a predictable
  // code defeats the entire mechanism.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = Date.now() + CODE_TTL_MS;

  await ref.set({
    codeHash: hashCode(email, code),
    expiresAt: Timestamp.fromMillis(expiresAt),
    issuedAt: Timestamp.now(),
    attempts: 0,
  });

  return { sent: true, code, expiresAt };
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "too-many-attempts" };

export async function verifyCode(
  email: string,
  code: string,
): Promise<VerifyOutcome> {
  const ref = doc(email);

  // The read, the attempt-count check, and the write that follows must be one
  // atomic operation. Three separate get()/update() calls let concurrent
  // guesses all read the same stale `attempts` value before any of them
  // writes back, which is exactly how an attacker races past MAX_ATTEMPTS.
  // Firestore's transaction isolation (tx.get/tx.update/tx.delete against a
  // single snapshot) closes that gap; nothing outside runTransaction should
  // touch this doc.
  return firestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);

    if (!snapshot.exists) return { ok: false, reason: "invalid" };

    const data = snapshot.data()!;
    const attempts = (data.attempts as number) ?? 0;
    const expiresAt = (data.expiresAt as Timestamp).toMillis();

    // `locked` is a distinct, auditable state from "expired" or "never
    // issued": it records that five guesses were burned, rather than
    // silently deleting the doc and leaving no trace of the lockout. The
    // `attempts >= MAX_ATTEMPTS` fallback covers a doc whose attempts
    // reached the cap without the locked field being set (defense in depth;
    // every path below that reaches the cap sets both together).
    if (data.locked === true || attempts >= MAX_ATTEMPTS) {
      if (data.locked !== true) tx.update(ref, { locked: true });
      return { ok: false, reason: "too-many-attempts" };
    }

    if (Date.now() > expiresAt) {
      tx.delete(ref);
      return { ok: false, reason: "expired" };
    }

    const expected = Buffer.from(data.codeHash as string);
    const actual = Buffer.from(hashCode(email, code.trim()));
    const matches =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const nextAttempts = attempts + 1;
      tx.update(
        ref,
        nextAttempts >= MAX_ATTEMPTS
          ? { attempts: nextAttempts, locked: true }
          : { attempts: nextAttempts },
      );
      return { ok: false, reason: "invalid" };
    }

    // Single use. Deleting on success prevents replay of an intercepted code.
    tx.delete(ref);
    return { ok: true };
  });
}
