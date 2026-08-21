#!/usr/bin/env node
// Copies the built Angular bundle into `public/` so the Next server hands it
// out same-origin.
//
// Same-origin is the constraint that decides this whole arrangement:
// `hub_session` is httpOnly and SameSite=lax, so a bundle served from another
// origin cannot carry the session at all. Next therefore stays as the host,
// serving `public/` and `app/api/**` and nothing else.
//
// Run by `npm run build` before `next build`, because `public/` is read at
// build time and baked into the standalone output.

import { cpSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BUNDLE = "web/dist/web/browser";
const PUBLIC = "public";

// Assets that belong to the Next host rather than the Angular build, and must
// survive a bundle refresh. Everything else in public/ is bundle output and is
// replaced wholesale, so a renamed chunk cannot linger and be served.
const HOST_ASSETS = new Set([
  "file.svg",
  "globe.svg",
  "lion.png",
  "lockup.png",
  "next.svg",
  "vercel.svg",
  "window.svg",
]);

if (!existsSync(BUNDLE)) {
  console.error(
    `No Angular bundle at ${BUNDLE}.\n` +
      "Run `npm run web:build` first, or `npm ci --prefix web` if dependencies are missing.",
  );
  process.exit(1);
}

for (const entry of readdirSync(PUBLIC)) {
  if (HOST_ASSETS.has(entry)) continue;
  rmSync(join(PUBLIC, entry), { recursive: true, force: true });
}

cpSync(BUNDLE, PUBLIC, { recursive: true });

const staged = readdirSync(PUBLIC).filter((e) => !HOST_ASSETS.has(e));
console.log(`Staged ${staged.length} bundle entries from ${BUNDLE} into ${PUBLIC}/`);

if (!staged.includes("index.html")) {
  console.error("index.html is missing from the staged bundle — the SPA rewrite would 404.");
  process.exit(1);
}
