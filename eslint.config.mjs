/**
 * Flat ESLint Configuration (ESLint 9)
 *
 * Errors are reserved for rules that catch real bugs or break a project rule
 * (hooks order, zero-emoji UI). Style-level findings are warnings so the
 * existing codebase lints clean while they are paid down.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// CLAUDE.md §3.3: zero emojis across production UI
const EMOJI = '/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B50}\\u{2B55}]/u';
const emojiMessage =
  'Emoji are not allowed in UI (CLAUDE.md §3.3). Use an SF Symbol / lucide icon.';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/build/**',
      '**/archive/**',
      '**/*.d.ts',
      'apps/mobile/src/shared/**',
      'supabase/.temp/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-restricted-syntax': [
        'error',
        { selector: `JSXText[value=${EMOJI}]`, message: emojiMessage },
        { selector: `Literal[value=${EMOJI}]`, message: emojiMessage },
        { selector: `TemplateElement[value.raw=${EMOJI}]`, message: emojiMessage },
      ],
    },
  },
  {
    // Edge Functions run on Deno
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
  }
);
