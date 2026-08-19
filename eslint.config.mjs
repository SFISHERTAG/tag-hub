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
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
