import js from '@eslint/js';
import tsPattern from '@danilqa/eslint-plugin-ts-pattern';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const KEBAB_CASE_FILES = {
  plugins: { unicorn },
  rules: { 'unicorn/filename-case': ['error', { case: 'kebabCase' }] },
};

export default defineConfig(
  globalIgnores(['ui/dist/']),
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  js.configs.recommended,
  KEBAB_CASE_FILES,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'ts-pattern': tsPattern },
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-check': false, 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true },
      ],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: false }],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [{ from: 'package', name: ['test'], package: 'node:test' }],
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'SwitchStatement',
          message: 'Use ts-pattern `match(...).exhaustive()` instead of switch/case.',
        },
        {
          selector: 'TSEnumDeclaration',
          message: 'Enums are not allowed. Use a union of literal types.',
        },
      ],
      'ts-pattern/prefer-match-on-union': 'error',
    },
  },
  {
    // Parses raw terminal input, which is made of escape sequences.
    files: ['src/tui/keys.ts'],
    rules: { 'no-control-regex': 'off' },
  },
);
