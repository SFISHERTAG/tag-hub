#!/usr/bin/env node
/**
 * Creates a Hub user in Identity Platform.
 *
 * There is no self-signup — accounts are created by TAG. This is that.
 *
 * Usage:
 *   read -rs "PW?Password: " && printf '%s' "$PW" \
 *     | node scripts/create-user.mjs someone@taxadvisorygrowth.net && unset PW
 *
 * The password arrives on stdin so it never lands in shell history or in a
 * process argument list visible to `ps`.
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2];

if (!email) {
  console.error("Usage: node scripts/create-user.mjs <email>   (password on stdin)");
  process.exit(1);
}

const password = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data.trim()));
});

if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "tag-success-hub";
if (getApps().length === 0) initializeApp({ projectId });

try {
  const user = await getAuth().createUser({
    email,
    password,
    emailVerified: true, // created by TAG, not self-registered
  });
  console.log(`Created ${user.email}`);
  console.log(`  uid: ${user.uid}`);
  console.log("\nRole and location claims land in Story 1.4.");
} catch (error) {
  if (error.code === "auth/email-already-exists") {
    console.error(`${email} already exists.`);
  } else {
    console.error(`Failed: ${error.message}`);
  }
  process.exit(1);
}
