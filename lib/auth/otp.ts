import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Timestamp } from "@google-cloud/firestore";
import { firestore } from "@/lib/firestore";

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

/**
 * Resend cooldown, kept separate from the code document so that deleting a code
 * (on success, expiry, or too many attempts) cannot also clear the rate limit.
 * Keyed by the same hash, so it reveals no address either.
 */
function cooldownDoc(email: string) {
  return firestore().doc(`authCodeCooldowns/${key(email)}`);
}

export type RequestOutcome =
  | { sent: true; code: string; expiresAt: number }
  | { sent: false; reason: "cooldown"; retryAfterMs: number };

export type CooldownState = { blocked: true; retryAfterMs: number } | { blocked: false };

/**
 * Resend cooldown for an address, checked WITHOUT regard to whether a user
 * exists.
 *
 * Separated from issueCode so the request route can apply it uniformly. It
 * previously ran only after a successful user lookup, which made the cooldown
 * response an account-existence oracle: submit any address twice inside the
 * window, and only a real one answered with `cooldown: true`.
 */
export async function checkCooldown(email: string): Promise<CooldownState> {
  const snapshot = await cooldownDoc(email).get();
  if (!snapshot.exists) return { blocked: false };

  const lastIssuedAt = (snapshot.data()?.lastIssuedAt as Timestamp | undefined)?.toMillis() ?? 0;
  const sinceLast = Date.now() - lastIssuedAt;
  if (sinceLast >= RESEND_COOLDOWN_MS) return { blocked: false };

  return { blocked: true, retryAfterMs: RESEND_COOLDOWN_MS - sinceLast };
}

/**
 * Starts the cooldown window for an address.
 *
 * Called for unknown addresses too. Without that, an unknown address never sets
 * a cooldown and so never produces the cooldown response, which reintroduces the
 * oracle from the other direction.
 */
export async function recordCooldown(email: string): Promise<void> {
  await cooldownDoc(email).set({ lastIssuedAt: Timestamp.now() });
}

/**
 * Issues a code. Returns it so the caller can deliver it — this module does not
 * send email, so the delivery mechanism stays swappable.
 */
export async function issueCode(email: string): Promise<RequestOutcome> {
  const ref = doc(email);

  // The cooldown lives on its own document, which verifyCode never touches.
  // Reading it off the code document made it resettable by the caller: burn the
  // five attempts (or wait for expiry), verifyCode deletes the code document,
  // and the next request sees no document and issues immediately. That is an
  // unbounded issue rate against an address, from an unauthenticated caller.
  const cooldown = await checkCooldown(email);
  if (cooldown.blocked) {
    return { sent: false, reason: "cooldown", retryAfterMs: cooldown.retryAfterMs };
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
  await recordCooldown(email);

  return { sent: true, code, expiresAt };
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "too-many-attempts" };

/**
 * Checks a code and consumes an attempt.
 *
 * Runs in a transaction because read-gate-write is not enough: the previous
 * version read a snapshot, compared `attempts` against the cap, and only then
 * wrote an incremented value. N parallel guesses all read the same pre-increment
 * value, all pass the cap, and all get a comparison — so the cap bounded the
 * count of sequential guesses, not the count of guesses. Against a 6-digit code
 * that is the difference between five tries and as many as an attacker can open
 * connections for. FieldValue.increment would fix the counter and leave the gate
 * racing; only a transaction fixes both.
 */
export async function verifyCode(
  email: string,
  code: string,
): Promise<VerifyOutcome> {
  const ref = doc(email);

  return firestore().runTransaction(async (tx): Promise<VerifyOutcome> => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return { ok: false, reason: "invalid" };

    const data = snapshot.data();
    if (!data) return { ok: false, reason: "invalid" };

    const attempts = (data.attempts as number) ?? 0;
    const expiresAt = (data.expiresAt as Timestamp).toMillis();

    if (attempts >= MAX_ATTEMPTS) {
      tx.delete(ref);
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
      tx.update(ref, { attempts: attempts + 1 });
      return { ok: false, reason: "invalid" };
    }

    // Single use. Deleting on success prevents replay of an intercepted code.
    tx.delete(ref);
    return { ok: true };
  });
}
