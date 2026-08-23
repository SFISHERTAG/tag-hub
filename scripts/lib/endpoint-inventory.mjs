// Pure, side-effect-free — no filesystem, no git, no exit — so this can be
// imported directly by a test. inventory-endpoints.mjs does the walking and
// the printing; everything that decides anything lives here.
//
// Story 11.5. An Angular SPA cannot call a Server Action and cannot import
// `lib/`, so every data path a screen needs has to exist as an endpoint under
// app/api/** first. That list is the endpoint spec for a feature story, and
// producing it by hand is how a story discovers its own size halfway through.

/**
 * Which feature area a path belongs to, or null if it is somewhere this
 * inventory does not track.
 *
 * The first segment, with three deliberate exceptions. `app/api/**` collapses
 * to one area however deep it goes, because endpoints are the thing being
 * counted rather than a feature. `app/l/[locationId]/**` stays whole: it is the
 * location-scoped surface and it migrates as one unit, so splitting it by its
 * dynamic segment would report four areas that cannot ship separately.
 *
 * And `lib/**` is included at all, which it was not until 2026-08-23. Server
 * Actions are not required to live under `app/` — `"use server"` marks the
 * file, not the directory — and `lib/auth/impersonation-actions.ts` had carried
 * two of them since story 3.3. The inventory reported "0 Server Actions
 * remaining" while that file existed, which is the one number this whole story
 * exists to get right: the count of `"use server"` files is the metric that has
 * to reach zero before the Next rendering path can be deleted.
 *
 * A blind spot in a progress metric reads as progress. Everything under `lib/`
 * collapses to one area for the same reason `app/api/**` does — it is not a
 * feature surface, it is a place actions should not be.
 */
export function featureAreaOf(path) {
  if (path.startsWith("lib/")) return "lib";
  if (!path.startsWith("app/")) return null;

  const rest = path.slice("app/".length);
  const segments = rest.split("/");

  // A file directly under app/ (app/page.tsx, app/layout.tsx) has no area of
  // its own; naming it keeps it visible instead of silently uncounted.
  if (segments.length === 1) return "root";

  return segments[0];
}

/**
 * Server Actions exported from a file, or `[]` if it is not a Server Action
 * file at all.
 *
 * The `"use server"` directive has to be a directive, not a mention. A comment
 * discussing it does not make the module callable over the wire, and counting
 * one as an action inflates the number the whole estimate rests on.
 */
export function extractServerActions(source) {
  if (!hasUseServerDirective(source)) return [];

  return [...source.matchAll(/^export\s+async\s+function\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
}

function hasUseServerDirective(source) {
  // Only a real leading directive counts: optional whitespace, then the
  // quoted string on its own line. `// "use server"` is prose.
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    return /^["']use server["'];?$/.test(trimmed);
  }
  return false;
}

/**
 * True if this file imports `lib/` directly.
 *
 * This is the other half of what the migration has to remove: a React Server
 * Component reaching into `lib/` is a data path with no HTTP equivalent. Only
 * a real import statement counts, so a comment pointing at a lib file does not
 * register as a dependency.
 */
export function importsLibDirectly(source) {
  return /^\s*import\s[^\n]*?from\s+["']@\/lib\//m.test(source);
}

/** The URL a route file serves, or null if it is not a route file. */
export function routePathOf(path) {
  if (!path.startsWith("app/") || !/\/route\.tsx?$/.test(path)) return null;

  return (
    "/" +
    path
      .slice("app/".length)
      .replace(/\/route\.tsx?$/, "")
  );
}

const isPage = (path) => /\/page\.tsx?$/.test(path);

/**
 * The inventory itself.
 *
 * `files` is `{ path, source }[]`, supplied by the caller so this stays pure.
 * Pass `{ area }` to scope to one feature area, which is how a story asks
 * about its own surface rather than the whole app.
 */
export function summarize(files, options = {}) {
  const { area } = options;

  const scoped = area ? files.filter((f) => featureAreaOf(f.path) === area) : files;

  // Typed rather than left to inference: `{}` widens to nothing useful, and a
  // consumer reading `byArea.portfolio.actions` should be checked, not cast.
  /** @type {Record<string, { actions: string[]; routes: string[]; pagesImportingLib: string[] }>} */
  const byArea = {};
  /** @type {string[]} */
  const routes = [];
  let actionCount = 0;
  let actionFileCount = 0;
  let pageCount = 0;
  let pagesImportingLib = 0;

  for (const file of scoped) {
    const fileArea = featureAreaOf(file.path) ?? "root";
    byArea[fileArea] ??= { actions: [], routes: [], pagesImportingLib: [] };

    const actions = extractServerActions(file.source);
    if (actions.length > 0) {
      actionFileCount++;
      actionCount += actions.length;
      byArea[fileArea].actions.push(...actions);
    }

    const route = routePathOf(file.path);
    if (route) {
      routes.push(route);
      byArea[fileArea].routes.push(route);
    }

    if (isPage(file.path)) {
      pageCount++;
      if (importsLibDirectly(file.source)) {
        pagesImportingLib++;
        byArea[fileArea].pagesImportingLib.push(file.path);
      }
    }
  }

  return {
    actionCount,
    actionFileCount,
    routeCount: routes.length,
    routes,
    pageCount,
    pagesImportingLib,
    byArea,
  };
}

/**
 * Whether an action already has an endpoint that plausibly covers it.
 *
 * Deliberately a name match against existing route paths and nothing cleverer.
 * It is a hint for triage, not a verdict: an endpoint sharing a noun with an
 * action may still not do what the action does. Reported as "possibly covered"
 * so nobody reads it as "done".
 */
export function possiblyCovered(actionName, routes) {
  const words = actionName
    .replace(/^(get|set|save|update|create|delete|mark|sync|refresh|resolve)/, "")
    .replace(/(Action|ForClient|ForCSM)$/, "")
    .toLowerCase();

  if (words.length < 4) return false;
  return routes.some((r) => r.toLowerCase().replace(/[^a-z]/g, "").includes(words));
}
