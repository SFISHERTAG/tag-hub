// GHL doesn't use google-auth-library, uses direct API tokens

const BASE_URL = "https://services.leadconnectorhq.com";

interface GhlTokenRequest {
  client_id: string;
  client_secret: string;
  grant_type: "refresh_token" | "authorization_code";
  refresh_token?: string;
  code?: string;
  redirect_uri?: string;
}

interface GhlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Get a GHL access token using the private integration token from env.
 * In production this would use OAuth flow; for provisioning we use PIT.
 */
export async function getGhlToken(): Promise<string> {
  const pit = process.env.GHL_PIT;
  if (!pit) throw new Error("GHL_PIT not set");
  return pit;
}

/**
 * Make an authenticated GHL API call.
 */
export async function ghlCall<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    locationId?: string;
  } = {}
): Promise<T> {
  const token = await getGhlToken();
  const url = new URL(path, BASE_URL);

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-07-28",
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

/**
 * Clone a GHL location (sub-account) from a template.
 * Returns the new location ID.
 */
export async function cloneLocation(templateLocationId: string, clientName: string): Promise<string> {
  interface SnapshotResponse {
    id: string;
    locationId: string;
  }

  const result = await ghlCall<SnapshotResponse>(`/location/${templateLocationId}/snapshot`, {
    method: "POST",
    body: {
      name: clientName,
    },
  });

  return result.locationId;
}

/**
 * Search for a location by name. Returns first match or null.
 */
export async function findLocationByName(name: string): Promise<string | null> {
  interface LocationsResponse {
    locations: Array<{
      id: string;
      name: string;
    }>;
  }

  const result = await ghlCall<LocationsResponse>("/location", {
    method: "GET",
  });

  const location = result.locations.find((loc) => loc.name === name);
  return location?.id ?? null;
}

/**
 * Create an opportunity in a location.
 */
export async function createOpportunity(
  locationId: string,
  data: {
    pipelineId: string;
    name: string;
    contactId?: string;
    value?: number;
    status?: string;
  }
): Promise<string> {
  interface OpportunityResponse {
    id: string;
  }

  const result = await ghlCall<OpportunityResponse>(
    `/location/${locationId}/opportunities`,
    {
      method: "POST",
      body: data,
      locationId,
    }
  );

  return result.id;
}

/**
 * Get opportunity details.
 */
export async function getOpportunity(
  locationId: string,
  opportunityId: string
): Promise<Record<string, unknown>> {
  return ghlCall(`/location/${locationId}/opportunities/${opportunityId}`, {
    locationId,
  });
}

/**
 * Get all pipelines for a location.
 */
export async function getPipelines(locationId: string): Promise<Array<{ id: string; name: string }>> {
  interface PipelinesResponse {
    pipelines: Array<{ id: string; name: string }>;
  }

  const result = await ghlCall<PipelinesResponse>(
    `/location/${locationId}/pipelines`,
    { locationId }
  );

  return result.pipelines;
}
