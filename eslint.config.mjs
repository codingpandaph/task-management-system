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
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: { 'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,mjs}'],
    extends: [...nextVitals, ...nextTypescript],
    settings: { next: { rootDir: 'apps/web/' } },
  },
  prettier,
]);
