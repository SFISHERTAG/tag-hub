import "server-only";
import { getTenant, type Service } from "../ghl/tenants";

/**
 * Enforce that a tenant has a service entitlement.
 * Throws 404-like error if not entitled (fail closed, expose nothing).
 */
export async function requireService(locationId: string, service: Service): Promise<void> {
  const tenant = await getTenant(locationId);
  if (!tenant.services[service]) {
    throw new Error(
      `404 Not Found: service ${service} not available for location ${locationId}`,
    );
  }
}
