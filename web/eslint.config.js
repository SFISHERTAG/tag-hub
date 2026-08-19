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
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
