import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/.test-dist/**',
    '**/generated/**',
    '**/next-env.d.ts',
    '.yarn/**',
    'playwright-report/**',
    'test-results/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: { globals: globals.node },
    rules: {
      eqeqeq: ['error', 'always'],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-duplicate-imports': 'error',
      'no-template-curly-in-string': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'apps/api/src/seed-cli.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,mjs}'],
    extends: [...nextVitals, ...nextTypescript],
    settings: { next: { rootDir: 'apps/web/' } },
  },
  prettier,
]);
