#!/usr/bin/env node
/**
 * Creates or updates a Hub user.
 *
 * There is no self-signup — accounts are created by TAG. Sign-in is by
 * six-digit email code, so no password is set or needed.
 *
 * Usage:
 *   node scripts/create-user.mjs someone@taxadvisorygrowth.net
 *   node scripts/create-user.mjs someone@taxadvisorygrowth.net --role tag_exec
 *
 * Roles are the full set from docs/prd.md. `tag_exec` is the closest thing to
 * a super admin: it reaches every location rather than an enumerated list.
 * Location claims arrive properly in Story 1.4; this sets the role now.
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Must stay in step with lib/auth/role-labels.ts. This is a plain .mjs script
// run without the TypeScript build, so it can't import the canonical list;
// scripts/check-role-parity.mjs fails the commit if the two disagree. Six roles
// were missing here before that check existed, which made it impossible to
// create an admin, a CS Director, or any setter from this CLI.
const ROLES = [
  "admin",
  "tag_exec",
  "tag_csd",
  "tag_csm",
  "tag_sales_manager",
  "tag_sales",
  "tag_setter_manager",
  "tag_setter",
  "client_owner",
  "client_manager",
  "client_closer",
  "client_setter_manager",
  "client_setter",
];

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const roleIndex = args.indexOf("--role");
const role = roleIndex !== -1 ? args[roleIndex + 1] : undefined;

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/create-user.mjs <email> [--role <role>]");
  console.error(`Roles: ${ROLES.join(", ")}`);
  process.exit(1);
}

if (role && !ROLES.includes(role)) {
  console.error(`Unknown role "${role}".`);
  console.error(`Roles: ${ROLES.join(", ")}`);
  process.exit(1);
}

// No fallback, on purpose — this script creates real users and grants real
// roles (including tag_exec, "the closest thing to a super admin"). An
// unset env var silently defaulting to the production project means a
// mistyped command grants production access instead of failing loudly.
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  console.error("GOOGLE_CLOUD_PROJECT is not set. Refusing to run against an unknown/default project.");
  process.exit(1);
}
console.log(`Targeting Firebase project: ${projectId}`);
if (getApps().length === 0) initializeApp({ projectId });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
  console.log(`Found existing user ${user.email}`);
} catch {
  user = await auth.createUser({
    email,
    emailVerified: true, // created by TAG, not self-registered
  });
  console.log(`Created ${user.email}`);
}

console.log(`  uid: ${user.uid}`);

if (role) {
  // The roles-array shape setUserClaims writes, not the legacy single `role`
  // key. The legacy key kept working at sign-in (parseRoleGrants migrates it)
  // but was invisible to the admin directory, and the next admin edit wiped
  // it anyway — setUserClaims owns the whole claims object. Empty locations
  // is the all-tenancies wildcard, matching what this script always meant.
  const rest = { ...(user.customClaims ?? {}) };
  delete rest.role;
  delete rest.locations;
  await auth.setCustomUserClaims(user.uid, { ...rest, roles: [{ role, locations: [] }] });
  console.log(`  role: ${role}`);
  console.log("\nClaims refresh on next sign-in. Sign out and back in if already signed in.");
} else if (user.customClaims?.roles?.[0]?.role || user.customClaims?.role) {
  console.log(`  role: ${user.customClaims?.roles?.[0]?.role ?? user.customClaims.role} (unchanged)`);
} else {
  console.log("  role: none — pass --role to set one");
}
