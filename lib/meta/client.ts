import "server-only";
import { FacebookAdsApi } from "facebook-nodejs-business-sdk";

/**
 * Meta Marketing API client.
 *
 * Blocked on Phase 2 of docs/meta-live-launch-plan.md: META_SYSTEM_USER_TOKEN
 * does not exist yet, only META_BUSINESS_ID (Phase 1). This module is safe to
 * import and call before that token exists — it reports "not configured"
 * rather than throwing on import, the same pattern SLACK_BOT_TOKEN and the
 * Google Picker vars use elsewhere in .env.example: absence degrades a
 * feature, it does not crash the app.
 *
 * Story 4.1 (System User + ad account access) is what turns `configured` true.
 * Stories 4.2+ and 5.4 call `getMetaApi()` once that happens.
 */

export class MetaNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Meta Marketing API is not configured. Missing: ${missing.join(", ")}. ` +
        `See docs/meta-live-launch-plan.md — Phase 2 (App + System User) must complete first.`,
    );
    this.name = "MetaNotConfiguredError";
  }
}

export class MetaApiError extends Error {
  constructor(
    readonly path: string,
    cause: unknown,
  ) {
    super(`Meta Marketing API call failed on ${path}: ${String(cause)}`);
    this.name = "MetaApiError";
  }
}

type MetaConfig = {
  businessId: string;
  appId: string;
  appSecret: string;
  systemUserToken: string;
};

/** Which required env vars are missing. Empty array means fully configured. */
export function metaMissingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.META_BUSINESS_ID) missing.push("META_BUSINESS_ID");
  if (!process.env.META_APP_ID) missing.push("META_APP_ID");
  if (!process.env.META_APP_SECRET) missing.push("META_APP_SECRET");
  if (!process.env.META_SYSTEM_USER_TOKEN) missing.push("META_SYSTEM_USER_TOKEN");
  return missing;
}

export function isMetaConfigured(): boolean {
  return metaMissingConfig().length === 0;
}

function getConfig(): MetaConfig {
  const missing = metaMissingConfig();
  if (missing.length > 0) throw new MetaNotConfiguredError(missing);

  return {
    businessId: process.env.META_BUSINESS_ID!,
    appId: process.env.META_APP_ID!,
    appSecret: process.env.META_APP_SECRET!,
    systemUserToken: process.env.META_SYSTEM_USER_TOKEN!,
  };
}

// Module-level singleton. FacebookAdsApi.init() sets a process-wide default
// client the SDK's model classes read from internally, so re-initializing
// per-request would be redundant work, not additional safety.
let initialized: FacebookAdsApi | null = null;

/**
 * Returns the initialized Marketing API client, authenticated as the System
 * User (not a personal user token — see docs/meta-live-launch-plan.md Phase 2).
 *
 * Throws MetaNotConfiguredError if Phase 2 hasn't produced a token yet. Every
 * caller should either let that propagate to a route that renders a "Meta
 * setup required" notice (Story 4.2 AC5), or check isMetaConfigured() first.
 */
export function getMetaApi(): FacebookAdsApi {
  if (initialized) return initialized;

  const config = getConfig();
  initialized = FacebookAdsApi.init(config.systemUserToken);
  return initialized;
}

/** The Business Portfolio ID (Phase 1, not secret — safe to expose in logs). */
export function getMetaBusinessId(): string {
  const businessId = process.env.META_BUSINESS_ID;
  if (!businessId) throw new MetaNotConfiguredError(["META_BUSINESS_ID"]);
  return businessId;
}
