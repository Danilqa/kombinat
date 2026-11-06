import js from '@eslint/js';
import tsPattern from '@danilqa/eslint-plugin-ts-pattern';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const componentPropsName = {
  meta: {
    type: 'suggestion',
    messages: { name: 'Type the props of {{component}} as a named `{{expected}}` interface.' },
    schema: [],
  },
  create(context) {
    const check = (name, fn) => {
      const annotation = fn.params[0]?.typeAnnotation?.typeAnnotation;
      if (name === undefined || !/^[A-Z]/.test(name) || annotation === undefined) return;
      const expected = `${name}Props`;
      const isExpected =
        annotation.type === 'TSTypeReference' &&
        annotation.typeName.type === 'Identifier' &&
        annotation.typeName.name === expected;
      if (!isExpected) {
        context.report({
          node: annotation,
          messageId: 'name',
          data: { component: name, expected },
        });
      }
    };
    return {
      FunctionDeclaration: node => check(node.id?.name, node),
      FunctionExpression: node => check(node.id?.name, node),
      VariableDeclarator: node => {
        if (node.id.type === 'Identifier' && node.init?.type === 'ArrowFunctionExpression') {
          check(node.id.name, node.init);
        }
      },
    };
  },
};

const KEBAB_CASE_FILES = {
  plugins: { unicorn },
  rules: { 'unicorn/filename-case': ['error', { case: 'kebabCase' }] },
};

export default defineConfig(
  globalIgnores(['ui/dist/', 'dist/', 'playwright-report/', 'test-results/']),
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
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^(Props$|I[A-Z])', match: false },
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
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
        {
          selector: 'TSTypeLiteral',
          message: 'Inline types are not allowed. Declare a named interface.',
        },
      ],
      'ts-pattern/prefer-match-on-union': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { kombinat: { rules: { 'component-props-name': componentPropsName } } },
    rules: { 'kombinat/component-props-name': 'error' },
  },
  {
    // Parses raw terminal input, which is made of escape sequences.
    files: ['src/tui/keys.ts'],
    rules: { 'no-control-regex': 'off' },
  },
  {
    // Playwright fixtures that depend on no other fixture take an empty object pattern.
    files: ['e2e/**/*.ts'],
    rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
  },
);
