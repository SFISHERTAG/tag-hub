import "server-only";

/**
 * Agency-level OAuth for GoHighLevel.
 *
 * The install flow grants a *company* (agency) token. That token is not used to
 * read sub-account data directly — instead it mints short-lived, location-scoped
 * tokens on demand. That indirection is what makes 40+ sub-accounts tractable:
 * one install, no per-client secret to provision.
 */

const AUTH_BASE = "https://marketplace.gohighlevel.com/oauth/chooselocation";
const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const LOCATION_TOKEN_URL =
  "https://services.leadconnectorhq.com/oauth/locationToken";

export const SCOPES = [
  "locations.readonly",
  "opportunities.readonly",
  "opportunities.write",
  "contacts.readonly",
  "contacts.write",
  "calendars.readonly",
  "calendars.write",
  "calendars/events.readonly",
  "calendars/events.write",
  "users.readonly",
] as const;

export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthConfigError";
  }
}

export function oauthConfig() {
  const clientId = process.env.GHL_CLIENT_ID?.trim();
  const clientSecret = process.env.GHL_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GHL_REDIRECT_URI?.trim();

  const missing = [
    !clientId && "GHL_CLIENT_ID",
    !clientSecret && "GHL_CLIENT_SECRET",
    !redirectUri && "GHL_REDIRECT_URI",
  ].filter(Boolean);

  if (missing.length) {
    throw new OAuthConfigError(
      `Missing ${missing.join(", ")}. Add them to hub/.env.local after creating ` +
        `the Marketplace app at marketplace.gohighlevel.com.`,
    );
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
  };
}

/**
 * URL that starts the install.
 *
 * `scopes` may be narrowed for diagnosis: GHL rejects the entire authorization
 * with a generic "Invalid Authorization!" if any requested scope is missing
 * from the published app version, without naming the offender. Requesting a
 * smaller set isolates which one is absent.
 */
export function installUrl(
  state: string,
  scopes: readonly string[] = SCOPES,
): string {
  const { clientId, redirectUri } = oauthConfig();
  const url = new URL(AUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export type AgencyToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  /** "Company" for an agency install, "Location" for a sub-account install. */
  userType: string;
  companyId?: string;
  locationId?: string;
};

async function postForm<T>(url: string, form: Record<string, string>, bearer?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Version: "2021-07-28",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GHL OAuth ${response.status} on ${url}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

/** Exchanges the install callback code for an agency token. */
export async function exchangeCode(code: string): Promise<AgencyToken> {
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  return postForm<AgencyToken>(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

/** Refreshes an expired agency token. */
export async function refreshAgencyToken(refreshToken: string): Promise<AgencyToken> {
  const { clientId, clientSecret } = oauthConfig();
  return postForm<AgencyToken>(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export type LocationToken = {
  access_token: string;
  expires_in: number;
  locationId: string;
};

/**
 * Mints a location-scoped token from the agency token.
 * This is the call that makes one install serve every sub-account.
 */
export async function mintLocationToken(
  agencyAccessToken: string,
  companyId: string,
  locationId: string,
): Promise<LocationToken> {
  return postForm<LocationToken>(
    LOCATION_TOKEN_URL,
    { companyId, locationId },
    agencyAccessToken,
  );
}
