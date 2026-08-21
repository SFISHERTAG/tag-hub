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
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "app/ghl/**",
              from: ["app/meta/**", "app/dashboard/**"],
              message: "GHL module cannot import from other integrations. Use API endpoints instead.",
            },
            {
              target: "app/meta/**",
              from: ["app/ghl/**", "app/dashboard/**"],
              message: "Meta module cannot import from other integrations. Use API endpoints instead.",
            },
            {
              target: "app/dashboard/**",
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
              target: ["lib/dashboard/**", "app/dashboard/**"],
              from: ["lib/postgres.ts", "lib/firestore.ts"],
              message:
                "Dashboard code must not query directly. Register a metric in lib/dashboard/metrics.ts — its fetch() takes a ScopeFilter, which is what keeps one user's rows out of another's dashboard.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
