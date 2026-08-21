import "server-only";
import { InvalidLocationError } from "@/lib/auth/groups";
import { badRequest, type JsonBody } from "../_lib/http";

/**
 * Location lists arrive either already split (`locations: string[]`) or as the
 * raw comma/newline text an admin typed into a textarea (`locationsRaw`).
 *
 * Both are accepted so the split rule stays server-side. The legacy server
 * action owned this parse; moving it to the Angular form would have made the
 * client the only place that decides what separates two ids, and a second
 * client (a script, a curl) would have had to guess.
 */
export function readLocations(body: JsonBody): string[] {
  const explicit = body.locations;
  if (explicit !== undefined) {
    if (!Array.isArray(explicit) || explicit.some((entry) => typeof entry !== "string")) {
      throw badRequest('"locations" must be an array of strings.');
    }
    return (explicit as string[]).map((entry) => entry.trim()).filter(Boolean);
  }

  const raw = body.locationsRaw;
  if (raw === undefined || raw === null) return [];
  if (typeof raw !== "string") throw badRequest('"locationsRaw" must be a string.');
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Runs a group/role write, turning `InvalidLocationError` into a 400.
 *
 * `createGroup` / `updateGroupRole` / `assignIndividualRole` all validate ids
 * through `isValidLocationId` and throw. That is the caller mistyping an id,
 * not the server breaking, and `toErrorResponse` suppresses 5xx messages — so
 * without this the admin would get "Something went wrong" instead of being
 * told which id is wrong.
 */
export async function withLocationValidation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof InvalidLocationError) throw badRequest(error.message);
    throw error;
  }
}
