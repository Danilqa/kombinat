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

const PACKAGE_NAMES = {
  utils: 'utils',
  'design-system': 'design-system',
  domains: 'domains',
  'web-app': 'web-app',
  tui: 'tui',
  cli: '@danilqa/kombinat',
};

// By name or by a relative path into the package folder, e.g. 'tui' or '../../tui/src/app'.
const packagesAbove = (...folders) => ({
  regex: String.raw`^((\.\./)+(${folders.join('|')})/|(${folders.map(folder => PACKAGE_NAMES[folder]).join('|')})(/|$))`,
  message:
    'Packages import only the packages below them: utils, design-system, domains, then web-app and tui, then cli.',
});

const daemonDomainsAbove = (...domains) => ({
  regex: String.raw`^(\.\./)+(domains/)?(${domains.join('|')})(/|$)`,
  message: 'Daemon domains import in one order: agent, routine, run, then scheduler and calendar.',
});

const sharedDomainsAbove = (...domains) => ({
  regex: String.raw`^((\.\./)+|domains/)(${domains.join('|')})(/|$)`,
  message:
    'Shared domains import in one order: agent, transcript, scheduler and daemon, then run, then routine and calendar.',
});

const NO_UI_IN_TERMINAL = {
  regex: String.raw`^(react|react-dom|react-router|design-system|domains/[^/]+/components|utils/hooks)(/|$)`,
  message: 'cli and tui never import React, design-system, domain components or utils/hooks.',
};

const NO_ROUTER = {
  regex: '^react-router(/|$)',
  message: 'Only web-app imports react-router, so components that link stay in web-app.',
};

const NO_NODE = {
  regex: '^node:',
  message: 'This code runs in the browser, so it never imports node:*.',
};

const UNIVERSAL_DOMAINS_MESSAGE =
  'cli and tui import this code too, so only domain components/ import React, lucide-react, design-system and utils/hooks.';

const NO_UI_IN_UNIVERSAL_DOMAINS = [
  {
    regex: String.raw`^(react|react-dom|lucide-react|design-system|utils/hooks)(/|$)`,
    message: UNIVERSAL_DOMAINS_MESSAGE,
  },
  { regex: '(^|/)components(/|$)', message: UNIVERSAL_DOMAINS_MESSAGE },
];

const UNIVERSAL_UTILS_MESSAGE =
  'cli and tui import this code too, so only utils/hooks imports React.';

const NO_REACT_IN_UNIVERSAL_UTILS = [
  { regex: '^(react|react-dom)(/|$)', message: UNIVERSAL_UTILS_MESSAGE },
  { regex: '(^|/)hooks(/|$)', message: UNIVERSAL_UTILS_MESSAGE },
];

const ONLY_SPECS_IMPORT_E2E = {
  regex: '^e2e(/|$)',
  message: 'Only *.e2e.ts specs import e2e/*.',
};

const ONLY_E2E_IMPORTS_PLAYWRIGHT = {
  regex: '^@playwright/test(/|$)',
  message:
    "Only packages/e2e imports @playwright/test. Specs take test and expect from 'e2e/web-app'.",
};

const ONLY_TESTS_IMPORT_MOCKS = {
  regex: '(^|/)mocks(/|$)',
  message: 'Only *.test.ts, *.e2e.ts and packages/e2e import mocks.',
};

const TEST_ONLY_IMPORTS = [
  ONLY_SPECS_IMPORT_E2E,
  ONLY_E2E_IMPORTS_PLAYWRIGHT,
  ONLY_TESTS_IMPORT_MOCKS,
];

const CLI_IMPORTS = [packagesAbove('web-app'), NO_UI_IN_TERMINAL];

const DOMAINS_IMPORTS = [packagesAbove('web-app', 'tui', 'cli'), NO_ROUTER];

const restrictImports = (files, ...patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

const restrictImportsOfKind = (files, ignores, ...patterns) => ({
  files,
  ignores,
  rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns }] },
});

export default defineConfig(
  globalIgnores(['**/dist/', '**/playwright-report/', '**/test-results/']),
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
    files: ['packages/tui/src/terminal/keys.ts'],
    rules: { 'no-control-regex': 'off' },
  },
  {
    // Playwright fixtures without dependencies take `{}`.
    files: ['packages/e2e/**/*.ts'],
    rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
  },
  // Where a file lives. A later block replaces the options of an earlier one, so each lists them all.
  restrictImports(['packages/cli/**'], ...CLI_IMPORTS),
  restrictImports(
    ['packages/cli/src/domains/agent/**'],
    ...CLI_IMPORTS,
    daemonDomainsAbove('routine', 'run', 'scheduler', 'calendar'),
  ),
  restrictImports(
    ['packages/cli/src/domains/routine/**'],
    ...CLI_IMPORTS,
    daemonDomainsAbove('run', 'scheduler', 'calendar'),
  ),
  restrictImports(
    ['packages/cli/src/domains/run/**'],
    ...CLI_IMPORTS,
    daemonDomainsAbove('scheduler', 'calendar'),
  ),
  restrictImports(['packages/tui/**'], packagesAbove('web-app', 'cli'), NO_UI_IN_TERMINAL),
  restrictImports(['packages/web-app/**'], packagesAbove('tui', 'cli')),
  restrictImports(['packages/domains/**'], ...DOMAINS_IMPORTS),
  restrictImports(
    ['packages/domains/{agent,transcript,scheduler,daemon}/**'],
    ...DOMAINS_IMPORTS,
    sharedDomainsAbove('run', 'routine', 'calendar'),
  ),
  restrictImports(
    ['packages/domains/run/**'],
    ...DOMAINS_IMPORTS,
    sharedDomainsAbove('routine', 'calendar'),
  ),
  restrictImports(
    ['packages/design-system/**'],
    packagesAbove('domains', 'web-app', 'tui', 'cli'),
    NO_ROUTER,
  ),
  restrictImports(
    ['packages/utils/**'],
    packagesAbove('design-system', 'domains', 'web-app', 'tui', 'cli'),
    NO_ROUTER,
  ),
  // What a file is. The typescript-eslint copy of the rule keeps these apart from the blocks above.
  restrictImportsOfKind(['packages/**/*.{ts,tsx}'], ['packages/e2e/**'], ...TEST_ONLY_IMPORTS),
  restrictImportsOfKind(
    ['packages/{web-app,domains,design-system,utils}/**/*.{ts,tsx}'],
    ['packages/web-app/vite.config.ts'],
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
  ),
  restrictImportsOfKind(
    ['packages/domains/**/*.{ts,tsx}'],
    ['packages/domains/*/components/**'],
    ...NO_UI_IN_UNIVERSAL_DOMAINS,
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
  ),
  restrictImportsOfKind(
    ['packages/utils/**/*.{ts,tsx}'],
    ['packages/utils/hooks/**'],
    ...NO_REACT_IN_UNIVERSAL_UTILS,
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
  ),
  restrictImportsOfKind(
    ['packages/**/*.test.ts'],
    ['packages/e2e/**'],
    ONLY_SPECS_IMPORT_E2E,
    ONLY_E2E_IMPORTS_PLAYWRIGHT,
  ),
  restrictImportsOfKind(['packages/**/*.e2e.ts'], ['packages/e2e/**'], ONLY_E2E_IMPORTS_PLAYWRIGHT),
);
