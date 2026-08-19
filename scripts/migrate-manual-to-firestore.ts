import { firestore } from "../lib/firestore";
import manual from "../_archive/manual-content.json";
import type { ManualPage } from "../lib/knowledge-base/types";

/**
 * One-time script: seeds `manual_pages` from `_archive/manual-content.json`
 * (the JSON the old static-HTML manual was built from — see
 * `_archive/generate-manual.js` and MANUAL_BUILD.md). Idempotent: re-running
 * overwrites each page doc with the source JSON's content, it does not
 * duplicate documents. It does NOT touch `manual_pages/{id}/versions` — if a
 * page was already edited via the admin UI (story 7.2), re-running this
 * script will overwrite that edit; check `manual_pages` in the Firestore
 * console before re-running against a project with live edits.
 *
 * Run: npx ts-node scripts/migrate-manual-to-firestore.ts
 *
 * Guard: this writes real Firestore data, so it prints the project id it's
 * about to write to and requires GOOGLE_CLOUD_PROJECT to be set explicitly
 * (no silent fallback to a default project — that's the exact failure mode
 * this guard exists to prevent, see CLAUDE.md "Secrets & environment").
 */

async function migrate() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    console.error("GOOGLE_CLOUD_PROJECT is not set. Refusing to run against an unknown/default project.");
    process.exit(1);
  }
  console.log(`Seeding manual_pages into Firestore project: ${projectId}`);

  const pages = manual.pages as ManualPage[];
  for (const page of pages) {
    const { id, ...fields } = page;
    await firestore().collection("manual_pages").doc(id).set(fields);
    console.log(`  ✓ ${id} — ${page.title}`);
  }

  console.log(`Done. Seeded ${pages.length} pages.`);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
