import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
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
  cli: 'kombinat',
  website: 'website',
};

// Matches 'tui' and '../../tui/src/app' alike.
const packagesAbove = (...folders) => ({
  regex: String.raw`^((\.\./)+(${folders.join('|')})/|(${folders.map(folder => PACKAGE_NAMES[folder]).join('|')})(/|$))`,
  message:
    'Packages import only the packages below them: utils, design-system, domains, then web-app and tui, then cli and website.',
});

// For a package with a src/domains folder of its own, which its files reach in at most ownLevels
// steps up: a path that climbs further is the domains package.
const domainsPackageByPath = ownLevels => ({
  regex: String.raw`^(\.\./){${ownLevels + 1},}domains/`,
  message: 'Import other workspace packages by name, not by a relative path.',
});

const packagesByPath = (...folders) => ({
  regex: String.raw`^(\.\./)+(${folders.join('|')})/`,
  message: 'Import other workspace packages by name, not by a relative path.',
});

const daemonDomains = (...domains) => ({
  regex: String.raw`^(\.\./)+(domains/)?(${domains.join('|')})(/|$)`,
  message:
    'Daemon domains import only the levels before their own: agent, settings, inbox and release, then routine, then run, then webhook, then scheduler.',
});

// Any domain may import the ids.ts of another, since ids.ts imports only zod.
const sharedDomains = (...domains) => ({
  regex: String.raw`^((\.\./)+|domains/)(${domains.join('|')})(?!/ids$)(/|$)`,
  message:
    'Shared domains import only the levels before their own, or the ids of any domain: agent, transcript, scheduler, daemon, webhook, settings and release, then run, then routine, calendar, inbox and insights.',
});

// web-app has a src/domains folder of its own, whose folders follow the shared order.
const webAppDomains = (...domains) => ({
  regex: String.raw`^(@web-app/domains/|(\.\./)+)(${domains.join('|')})(/|$)`,
  message:
    'A web-app domain imports only the domains on the levels before its own, as the shared domains do. Pages and the layout put domains of one level together.',
});

// tui has a src/domains folder too, and every import inside tui is a relative path.
const tuiDomains = (...domains) => ({
  regex: String.raw`^(\.\./)+(${domains.join('|')})/`,
  message:
    'A tui domain imports only the domains on the levels before its own, as the shared domains do. Pages and the app put domains of one level together.',
});

const NO_SHELL_IN_TUI_DOMAINS = {
  regex: String.raw`^(\.\./)+(app(-[a-z-]+)?$|pages/)`,
  message: 'The app and its pages build on the tui domains, so a domain never imports them.',
};

const NO_SHELL_IN_WEB_APP_DOMAINS = {
  regex: String.raw`^(@web-app/|(\.\./)+)(app(-[a-z-]+)?$|layout(/|$)|pages(/|$))`,
  message:
    'The app, its layout and its pages build on the web-app domains, so a domain never imports them.',
};

const ONLY_WEB_APP_EXPORTS_IN_WEBSITE = {
  regex: '^@web-app/',
  message:
    'website imports web-app through its package exports, such as web-app/app. The @web-app alias only resolves the imports of web-app itself.',
};

const ONLY_TERMINAL_IN_TERMINAL = {
  regex: String.raw`^\.\./`,
  message: 'terminal/ is the layer under the rest of tui, so it imports nothing else of tui.',
};

const ONLY_ZOD_IN_IDS = {
  regex: '^(?!zod$)',
  message: 'ids.ts imports only zod, so that any domain can import it without a cycle.',
};

const DAEMON_DOMAIN_LEVELS = [
  ['agent', 'settings', 'inbox', 'release'],
  ['routine'],
  ['run'],
  ['webhook'],
  ['scheduler'],
];

const SHARED_DOMAIN_LEVELS = [
  ['agent', 'transcript', 'scheduler', 'daemon', 'webhook', 'settings', 'release'],
  ['run'],
  ['routine', 'calendar', 'inbox', 'insights'],
];

const NO_UI_IN_TERMINAL = {
  regex: String.raw`^(react|react-dom|react-router|@tanstack/react-query|lucide-react|design-system)(/|$)`,
  message: 'cli and tui never import React, React Query or design-system.',
};

const NO_ROUTER = {
  regex: '^react-router(/|$)',
  message: 'Only web-app and website import react-router, so components that link stay there.',
};

const NO_NODE = {
  regex: '^node:',
  message: 'This code runs in the browser, so it never imports node:*.',
};

const NO_UI_IN_DOMAINS = {
  regex: String.raw`^(react|react-dom|@tanstack/react-query|lucide-react|design-system)(/|$)`,
  message:
    'domains is pure TypeScript that cli and tui import too, so it never imports React, React Query, lucide-react or design-system. Domain components live in web-app.',
};

const NO_REACT_IN_UTILS = {
  regex: '^(react|react-dom|@tanstack/react-query)(/|$)',
  message: 'cli and tui import utils too, so it never imports React.',
};

const NO_BARREL_INSIDE_DESIGN_SYSTEM = {
  regex: String.raw`^\.{1,2}(/index)?/?$`,
  message:
    'Inside design-system, import the component you need by relative path, such as ../tooltip, never the root barrel.',
};

const NO_SELF_IMPORT_INSIDE_DESIGN_SYSTEM = {
  regex: '^design-system(/|$)',
  message:
    'Inside design-system, import the component you need by relative path, not by package name.',
};

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

const NO_ENTRY_POINTS_IN_CLI = {
  regex: String.raw`^(\.\./)+(server|cli|api/.+)$`,
  message:
    'cli.ts, server.ts and api/ wire the daemon together, so domains and features never import them.',
};

const NO_TRANSPORT_IN_CLI_API = {
  regex: String.raw`^\.\./(server|cli)$`,
  message: 'server.ts serves the handlers of api/, so api/ never imports it or cli.ts.',
};

const NO_FEATURES_IN_DAEMON_DOMAINS = {
  regex: String.raw`^(\.\./)+features/`,
  message: 'A feature builds on the daemon domains, so a domain never imports a feature.',
};

const ONLY_UTILS_API_IMPORTS_KY = {
  regex: '^ky(/|$)',
  message: 'Only utils/api.ts imports ky. Make a client with createApi from utils/api.',
};

const DATA_LAYER_MESSAGE =
  'Only queries.ts files call the requests and React Query. Add a hook to the queries.ts of the domain and call it.';

const ONLY_QUERIES_FETCH = [
  { regex: String.raw`^domains/[^/]+/requests$`, message: DATA_LAYER_MESSAGE },
  { regex: '^@web-app/api$', message: DATA_LAYER_MESSAGE },
  {
    regex: '^@tanstack/react-query$',
    importNames: [
      'useQuery',
      'useQueries',
      'useInfiniteQuery',
      'useSuspenseQuery',
      'useSuspenseQueries',
      'useSuspenseInfiniteQuery',
      'useMutation',
    ],
    message: DATA_LAYER_MESSAGE,
  },
];

const TEST_ONLY_IMPORTS = [
  ONLY_SPECS_IMPORT_E2E,
  ONLY_E2E_IMPORTS_PLAYWRIGHT,
  ONLY_TESTS_IMPORT_MOCKS,
];

// cli has its own domains/ and utils/ folders.
const CLI_IMPORTS = [
  {
    ...packagesAbove('web-app'),
    message: 'cli serves the web-app build from dist/web-app and never imports web-app.',
  },
  packagesAbove('website'),
  NO_UI_IN_TERMINAL,
  packagesByPath('design-system', 'tui', 'e2e'),
];

const WEB_APP_IMPORTS = [
  packagesAbove('tui', 'cli', 'website'),
  packagesByPath('utils', 'design-system', 'domains', 'e2e'),
];

const TUI_IMPORTS = [
  packagesAbove('web-app', 'cli', 'website'),
  NO_UI_IN_TERMINAL,
  packagesByPath('utils', 'design-system', 'e2e'),
  domainsPackageByPath(1),
];

const DOMAINS_IMPORTS = [
  packagesAbove('web-app', 'tui', 'cli', 'website'),
  NO_ROUTER,
  packagesByPath('utils', 'design-system', 'e2e'),
];

const restrictImports = (files, ...patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

const restrictDomainOrder = (folder, levels, domainsPattern, imports) =>
  levels.flatMap((level, index) => {
    const notBelow = levels.slice(index).flat();
    return level.map(domain =>
      restrictImports(
        [`${folder}/${domain}/**`],
        ...imports,
        domainsPattern(...notBelow.filter(other => other !== domain)),
      ),
    );
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
    },
  },
  js.configs.recommended,
  pluginQuery.configs['flat/recommended'],
  KEBAB_CASE_FILES,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/web-app/public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
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
  // A later block replaces the options of an earlier one, so each lists them all.
  restrictImports(['packages/cli/**'], ...CLI_IMPORTS),
  restrictImports(['packages/cli/src/features/**'], ...CLI_IMPORTS, NO_ENTRY_POINTS_IN_CLI),
  restrictImports(['packages/cli/src/api/**'], ...CLI_IMPORTS, NO_TRANSPORT_IN_CLI_API),
  ...restrictDomainOrder('packages/cli/src/domains', DAEMON_DOMAIN_LEVELS, daemonDomains, [
    ...CLI_IMPORTS,
    NO_ENTRY_POINTS_IN_CLI,
    NO_FEATURES_IN_DAEMON_DOMAINS,
  ]),
  restrictImports(['packages/tui/**'], ...TUI_IMPORTS),
  restrictImports(['packages/tui/src/terminal/**'], ...TUI_IMPORTS, ONLY_TERMINAL_IN_TERMINAL),
  ...restrictDomainOrder('packages/tui/src/domains', SHARED_DOMAIN_LEVELS, tuiDomains, [
    ...TUI_IMPORTS,
    NO_SHELL_IN_TUI_DOMAINS,
  ]),
  restrictImports(['packages/web-app/**'], ...WEB_APP_IMPORTS),
  ...restrictDomainOrder('packages/web-app/src/domains', SHARED_DOMAIN_LEVELS, webAppDomains, [
    ...WEB_APP_IMPORTS,
    NO_SHELL_IN_WEB_APP_DOMAINS,
  ]),
  restrictImports(
    ['packages/website/**'],
    packagesAbove('tui', 'cli'),
    packagesByPath('utils', 'design-system', 'web-app', 'e2e'),
    domainsPackageByPath(2),
    ONLY_WEB_APP_EXPORTS_IN_WEBSITE,
  ),
  restrictImports(
    ['packages/promo/**'],
    {
      ...packagesAbove('web-app', 'tui', 'cli', 'website'),
      message:
        'promo draws its scenes with design-system and records the website from its build, never by import.',
    },
    packagesByPath('utils', 'design-system', 'domains', 'e2e'),
  ),
  restrictImports(['packages/domains/**'], ...DOMAINS_IMPORTS),
  ...restrictDomainOrder('packages/domains', SHARED_DOMAIN_LEVELS, sharedDomains, DOMAINS_IMPORTS),
  restrictImports(['packages/domains/*/ids.ts'], ONLY_ZOD_IN_IDS),
  restrictImports(
    ['packages/design-system/**'],
    packagesAbove('domains', 'web-app', 'tui', 'cli', 'website'),
    NO_ROUTER,
    packagesByPath('utils', 'e2e'),
    NO_BARREL_INSIDE_DESIGN_SYSTEM,
    NO_SELF_IMPORT_INSIDE_DESIGN_SYSTEM,
  ),
  restrictImports(
    ['packages/utils/**'],
    packagesAbove('design-system', 'domains', 'web-app', 'tui', 'cli', 'website'),
    NO_ROUTER,
    packagesByPath('e2e'),
  ),
  // The typescript-eslint copy of the rule, so these do not replace the blocks above.
  restrictImportsOfKind(
    ['packages/**/*.{ts,tsx}'],
    ['packages/e2e/**'],
    ...TEST_ONLY_IMPORTS,
    ONLY_UTILS_API_IMPORTS_KY,
  ),
  restrictImportsOfKind(
    ['packages/{web-app,website,design-system}/**/*.{ts,tsx}'],
    ['packages/{web-app,website}/vite.config.ts'],
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
    ONLY_UTILS_API_IMPORTS_KY,
  ),
  restrictImportsOfKind(
    ['packages/{web-app,website}/src/**/*.{ts,tsx}'],
    ['packages/{web-app,website}/src/**/queries.ts', 'packages/web-app/src/api.ts'],
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
    ONLY_UTILS_API_IMPORTS_KY,
    ...ONLY_QUERIES_FETCH,
  ),
  restrictImportsOfKind(
    ['packages/{web-app,website}/src/**/queries.ts'],
    [],
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
    ONLY_UTILS_API_IMPORTS_KY,
    {
      ...NO_ROUTER,
      message:
        'queries.ts never imports react-router. What follows a request stays with the caller.',
    },
  ),
  // The scenes run in the browser, the scripts that record them in Node.
  restrictImportsOfKind(
    ['packages/promo/src/**/*.{ts,tsx}'],
    [],
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
    ONLY_UTILS_API_IMPORTS_KY,
  ),
  restrictImportsOfKind(
    ['packages/domains/**/*.ts'],
    [],
    NO_UI_IN_DOMAINS,
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
    ONLY_UTILS_API_IMPORTS_KY,
  ),
  restrictImportsOfKind(
    ['packages/utils/**/*.{ts,tsx}'],
    ['packages/utils/api.ts'],
    NO_REACT_IN_UTILS,
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
    ONLY_UTILS_API_IMPORTS_KY,
  ),
  restrictImportsOfKind(
    ['packages/utils/api.ts'],
    [],
    NO_REACT_IN_UTILS,
    NO_NODE,
    ...TEST_ONLY_IMPORTS,
  ),
  restrictImportsOfKind(
    ['packages/**/*.test.ts'],
    ['packages/e2e/**', 'packages/utils/api.test.ts'],
    ONLY_SPECS_IMPORT_E2E,
    ONLY_E2E_IMPORTS_PLAYWRIGHT,
    ONLY_UTILS_API_IMPORTS_KY,
  ),
  restrictImportsOfKind(
    ['packages/utils/api.test.ts'],
    [],
    ONLY_SPECS_IMPORT_E2E,
    ONLY_E2E_IMPORTS_PLAYWRIGHT,
  ),
  restrictImportsOfKind(
    ['packages/**/*.e2e.ts'],
    ['packages/e2e/**'],
    ONLY_E2E_IMPORTS_PLAYWRIGHT,
    ONLY_UTILS_API_IMPORTS_KY,
  ),
);
