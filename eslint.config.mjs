import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archived pre-Angular code. Kept for history, not maintained, and not
    // worth a linter's opinion — it accounted for most of this config's
    // standing error count. Mirrors the same exclusion in tsconfig.json.
    "_archive/**",
    // The Angular workspace has its own ESLint config and its own gate
    // (npm run web:lint). Linting it with the Next config is meaningless.
    "web/**",
    // Other isolated agent worktrees live here, nested under this repo root,
    // each a full separate checkout — linting them as part of this one
    // crashes on the sheer volume and reports issues that have nothing to
    // do with this checkout's actual source (see the same fix in
    // vitest.config.mts).
    ".claude/worktrees/**",
    // Generated, vendored, or compiled output. None of it is authored here,
    // and linting it made the gate structurally unpassable: 26 of the 77
    // errors on this branch came from minified Angular vendor bundles in a
    // build cache and from an archived script. A rule nobody can satisfy is
    // a rule everybody learns to ignore, which is how the whole lint gate
    // ended up decorative.
    ".angular/**",
    "functions/dist/**",
    "coverage/**",

    // Retired Next surfaces. Moved wholesale out of app/ when the Angular
    // cutover began: out of the build via tsconfig.json, kept on disk because
    // they are the reference implementation every feature story ports from.
    // Linting them would report on code that no longer runs and invite someone
    // to fix a screen that is being replaced.
    "legacy/**",

    // Build output, not source. scripts/stage-angular-bundle.mjs copies the
    // compiled Angular bundle in here at build time; linting minified chunks
    // produced 1485 warnings and 3 errors from code nobody wrote.
    "public/**",

    // Dead tree, kept for reference and already excluded from typecheck in
    // tsconfig.json for the same reason: zero call sites anywhere in app/,
    // lib/, test/ or functions/. Queued for deletion in the cleanup pass;
    // ignored here so it cannot hold the gate red until then.
    "src/**",
  ]),
  {
    plugins: { import: importPlugin },
    rules: {
      // Architecture isolation: prevent cross-integration imports.
      // Each integration (ghl, meta, drive, slack) is isolated.
      // Only lib/* may be shared.
      //
      // Paths are under app/api/ because the Angular cutover deleted the Next
      // page surfaces (app/ghl/, app/meta/, app/dashboard/) and left every
      // integration as endpoints only. The zones kept the old targets and so
      // matched nothing; repointed with no violations found in the move.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "app/api/ghl/**",
              from: ["app/api/meta/**", "app/api/dashboard/**"],
              message: "GHL module cannot import from other integrations. Use API endpoints instead.",
            },
            {
              target: "app/api/meta/**",
              from: ["app/api/ghl/**", "app/api/dashboard/**"],
              message: "Meta module cannot import from other integrations. Use API endpoints instead.",
            },
            {
              target: "app/api/dashboard/**",
              from: ["functions/**"],
              message: "Dashboard cannot import from Cloud Functions. Use HTTP endpoints.",
            },
            {
              target: "functions/**",
              from: ["app/**"],
              message: "Cloud Functions cannot import from app. Shared logic goes to lib/.",
            },
            {
              // Dashboard data access goes through the metric registry, whose
              // fetch signature requires a ScopeFilter. A direct query bypasses
              // that and re-opens the "forgot to filter by user" leak the brand
              // exists to prevent. See docs/ROLE_SCOPE_MODEL.md.
              // `app/api/**`, not `app/dashboard/**`: the Angular cutover deleted
              // the Next dashboard pages and the data path moved under
              // app/api/dashboard/**, which left this zone guarding a directory
              // that no longer exists. Widened to the whole endpoint surface
              // because that is now the only server-side caller.
              target: ["lib/dashboard/**", "app/api/**"],
              from: ["lib/postgres.ts", "lib/firestore.ts"],
              message:
                "Dashboard code must not query directly. Register a metric in lib/dashboard/metrics.ts — its fetch() takes a ScopeFilter, which is what keeps one user's rows out of another's dashboard.",
            },
          ],
        },
      ],
    },
  },

  /*
   * Story 14.1: the repository seam.
   *
   * Firestore is reachable from exactly one module, lib/data/firestore-repository.ts.
   * Everything else goes through the Repository interface, so 14.2 onward can
   * swap the backing store without touching a call site.
   *
   * This is the load-bearing half of the story. Without it new code bypasses
   * the seam by convenience rather than intent, which is how the one bypass
   * that existed got there: lib/ghl/store.ts re-exported the client handle, so
   * fifteen importers could have obtained it without importing lib/firestore
   * at all.
   *
   * A re-export cannot escape this rule. `export { firestore } from "@/lib/firestore"`
   * is an import and is caught here; so is importing it in order to re-export
   * it. No separate symbol check is needed.
   *
   * lib/data/** is the exemption because it IS the implementation. scripts/ is
   * out of scope: seed and setup scripts run standalone against a project id
   * and are not part of the request path. functions/ has its own workspace and
   * its own Firestore client, and folds into app/api under story 14.A.
   */
  {
    files: ["lib/**/*.ts", "app/**/*.ts", "app/**/*.tsx"],
    ignores: ["lib/data/**", "lib/firestore.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/firestore",
              message:
                "Firestore is reachable only through the repository seam. Use `repository()` from @/lib/data. If the operation you need is missing, add it to the Repository interface rather than reaching past it — that interface is what 14.2 implements a second time over Postgres.",
            },
            {
              name: "@google-cloud/firestore",
              message:
                "The Firestore SDK stays behind lib/data. Timestamp and FieldValue in particular must not cross the seam: the repository normalises timestamps to epoch millis and exposes serverTimestamp()/deleteField()/arrayUnion() from @/lib/data, which have real Postgres equivalents.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/firestore", "**/lib/firestore.js"],
              message:
                "Firestore is reachable only through the repository seam. Use `repository()` from @/lib/data.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
