import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

/**
 * The functions workspace lints itself.
 *
 * It did not until 2026-08-23: `eslint` was in neither `dependencies` nor
 * `devDependencies` here and resolved from the root `node_modules`, so
 * `npm run lint` inside functions worked only because something above it
 * happened to be installed. That is why the cloudbuild gate had to install the
 * whole root tree — 938 MB — to lint one workspace.
 *
 * The parser is the part that has to be declared explicitly. Without
 * `typescript-eslint` every `src/**\/*.ts` file failed with "Parsing error:
 * Unexpected token :" — twenty of them — because eslint was reading TypeScript
 * with the default JavaScript parser. A config that cannot parse the files it
 * targets does not report zero problems; it reports the wrong ones, and
 * `check:functions` exited 1 on every run.
 */
export default defineConfig([
  {
    ignores: ["dist/**", "coverage/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
    },
    rules: {
      /*
       * `import/no-unresolved` is off, and it is off rather than configured
       * because tsc already does this job correctly and runs in the same gate.
       *
       * Enabled, it produced 32 errors and every one was a false positive.
       * Two causes, neither fixable by an ignore list. This workspace compiles
       * to NodeNext, where TypeScript requires `import "./intake-format.js"`
       * for a file that is `intake-format.ts` on disk — eslint's resolver looks
       * for the `.js` and does not find it. And `firebase-admin/auth` is a
       * package subpath export, which the basic resolver does not follow.
       *
       * Making it work needs eslint-import-resolver-typescript, a third
       * dependency to re-derive what `npm run build` has already proved one
       * command earlier. A rule that can only be satisfied by duplicating the
       * compiler is not carrying its weight.
       */
      "import/no-unresolved": "off",
      // The base rule misreads TypeScript's type-only positions, so the
      // TS-aware version replaces it.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);
