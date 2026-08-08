import "server-only";
import { resolveToken } from "./tokens";

const BASE_URL = "https://services.leadconnectorhq.com";

// GHL versions its API by header. Most endpoints accept this; pass a `version`
// override on the call if a specific endpoint rejects it.
const DEFAULT_VERSION = "2021-07-28";

export class GhlError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`GHL ${status} on ${path}: ${body.slice(0, 500)}`);
    this.name = "GhlError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  searchParams?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  version?: string;
  /** Seconds to cache. 0 disables caching. */
  revalidate?: number;
};

/**
 * Makes an authenticated GHL request on behalf of a specific location.
 *
 * Every call names its location explicitly — there is no ambient "current
 * location". That is what keeps multi-tenant access honest: a caller cannot
 * accidentally read another client's data by forgetting to scope a query.
 */
export async function ghl<T>(
  locationId: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = await resolveToken(locationId);
  const {
    method = "GET",
    searchParams,
    body,
    version = DEFAULT_VERSION,
    revalidate = 0,
  } = options;

  const url = new URL(path, BASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate },
  });

  if (!response.ok) {
    throw new GhlError(response.status, path, await response.text());
  }

  return (await response.json()) as T;
}
