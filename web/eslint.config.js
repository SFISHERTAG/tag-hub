// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // CLAUDE.md forbids non-null assertions, and `strict` does not cover
      // them: that rule ships in typescript-eslint's `strict` config, while
      // this file extends `recommended` + `stylistic` only.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // CLAUDE.md's permission contract names this directive `*hasPermission`
    // specifically (not `*appHasPermission`), so it's exempt from the
    // project-wide `app` selector prefix used everywhere else.
    files: ['**/has-permission.directive.ts'],
    rules: {
      '@angular-eslint/directive-selector': 'off',
    },
  },
  // Architecture isolation, per CLAUDE.md and docs/frontend-file-tree.md.
  //
  // Implemented with core `no-restricted-imports` rather than
  // eslint-plugin-import's `no-restricted-paths`: this workspace runs ESLint 10,
  // that plugin's peer range stops at ^9, and npm 11 resolves peers strictly, so
  // it cannot be installed here at all.
  //
  // Patterns match the import specifier as written, so they are deliberately
  // depth-independent: `**/ghl/**` catches `../ghl/x`, `../../ghl/x` and
  // `../../features/ghl/x` alike. A path with no `ghl` segment — which is what
  // every GHL-internal import looks like — cannot match.
  //
  // ESLint replaces rule configuration rather than merging it, so each block
  // below restates every ban that applies to its files.
  {
    files: ['src/app/features/**/*.ts'],
    ignores: ['src/app/widget-loaders.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/layout/**'],
              message:
                'A feature must not import the shell. Route into it or emit an event; a feature that reaches into layout/ cannot be lazy-loaded or deleted independently.',
            },
            {
              group: ['**/ghl/**', '**/meta/**', '**/drive/**', '**/slack/**'],
              message:
                'Integration modules are isolated: no feature may import ghl, meta, drive or slack directly. Add a backend endpoint instead (CLAUDE.md, architecture isolation).',
            },
          ],
        },
      ],
    },
  },
  {
    // Inside ghl/, importing its own files is normal; the ban is on siblings.
    files: ['src/app/features/ghl/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/layout/**'],
              message:
                'A feature must not import the shell. Route into it or emit an event; a feature that reaches into layout/ cannot be lazy-loaded or deleted independently.',
            },
            {
              group: ['**/meta/**', '**/drive/**', '**/slack/**'],
              message:
                'Integration modules must not import each other. ghl cannot reach into meta, drive, slack — cross-integration data goes through one backend endpoint (CLAUDE.md, architecture isolation).',
            },
          ],
        },
      ],
    },
  },
  {
    // Inside meta/, importing its own files is normal; the ban is on siblings.
    files: ['src/app/features/meta/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/layout/**'],
              message:
                'A feature must not import the shell. Route into it or emit an event; a feature that reaches into layout/ cannot be lazy-loaded or deleted independently.',
            },
            {
              group: ['**/ghl/**', '**/drive/**', '**/slack/**'],
              message:
                'Integration modules must not import each other. meta cannot reach into ghl, drive, slack — cross-integration data goes through one backend endpoint (CLAUDE.md, architecture isolation).',
            },
          ],
        },
      ],
    },
  },
  {
    // Inside drive/, importing its own files is normal; the ban is on siblings.
    files: ['src/app/features/drive/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/layout/**'],
              message:
                'A feature must not import the shell. Route into it or emit an event; a feature that reaches into layout/ cannot be lazy-loaded or deleted independently.',
            },
            {
              group: ['**/ghl/**', '**/meta/**', '**/slack/**'],
              message:
                'Integration modules must not import each other. drive cannot reach into ghl, meta, slack — cross-integration data goes through one backend endpoint (CLAUDE.md, architecture isolation).',
            },
          ],
        },
      ],
    },
  },
  {
    // Inside slack/, importing its own files is normal; the ban is on siblings.
    files: ['src/app/features/slack/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/layout/**'],
              message:
                'A feature must not import the shell. Route into it or emit an event; a feature that reaches into layout/ cannot be lazy-loaded or deleted independently.',
            },
            {
              group: ['**/ghl/**', '**/meta/**', '**/drive/**'],
              message:
                'Integration modules must not import each other. slack cannot reach into ghl, meta, drive — cross-integration data goes through one backend endpoint (CLAUDE.md, architecture isolation).',
            },
          ],
        },
      ],
    },
  },
  {
    // The shell and the shared layer must not depend on any feature. This is
    // what keeps the dashboard ignorant of which integrations exist.
    //
    // The shared/ ban stops at features/ and layout/ and deliberately does NOT
    // cover core/services/: has-permission.directive.ts imports
    // PermissionService, and CLAUDE.md mandates both halves of that pairing.
    files: ['src/app/layout/**/*.ts', 'src/app/shared/**/*.ts', 'src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**'],
              message:
                'core/, shared/ and layout/ must not know which features exist. Resolve features by route, or widgets by id through the WidgetRegistry.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
