import "server-only";
import { PRODUCTION_PROJECT_ID, isProductionProject } from "./config";

/**
 * The guard every seed script runs before its first write.
 *
 * CLAUDE.md is unambiguous: "Seed scripts detect NODE_ENV and the target GCP
 * project before any `.set()` write. No exceptions." Two of them did not, and
 * both inherited the old production-project fallback — so running either one
 * locally overwrote real client records with invented company names and
 * health scores, then printed a success message.
 *
 * `scripts/migrate-manual-to-firestore.ts` already did this correctly and
 * cited CLAUDE.md by name while doing it, which is the tell: the pattern was
 * known, it just was not shared. It lives here now so a third seed script
 * cannot get it wrong by omission.
 *
 * Production is refused outright rather than prompted for. A seed script has
 * no legitimate reason to run against live client data, and an "are you
 * sure" prompt is a thing people say yes to.
 */
export function assertSafeToSeed(scriptName: string): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim();

  if (!projectId) {
    console.error(
      `${scriptName}: GOOGLE_CLOUD_PROJECT is not set. Refusing to run against an unknown ` +
        `or default project — the default used to be ${PRODUCTION_PROJECT_ID}.`,
    );
    process.exit(1);
  }

  if (isProductionProject(projectId)) {
    console.error(
      `${scriptName}: GOOGLE_CLOUD_PROJECT is ${projectId}, the production project. ` +
        `Refusing to write fabricated seed data to live client records.`,
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error(`${scriptName}: NODE_ENV is production. Refusing to seed.`);
    process.exit(1);
  }

  console.log(`${scriptName}: seeding into GCP project "${projectId}" (NODE_ENV=${process.env.NODE_ENV ?? "unset"}).`);
  return projectId;
}
