# AGENTS.md

Kombinat runs routines, markdown files in `routines/`, with AI agents on a schedule under launchd. This repo is a pnpm workspace: the published CLI and daemon, the browser and terminal dashboards, and the packages they share. The repo root is also a routines folder of its own.

## Packages

| Package         | Description                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `cli`           | `@danilqa/kombinat`, the only published package: CLI commands and the daemon                                                          |
| `web-app`       | Browser dashboard (React, Vite, Tailwind), built into `packages/cli/dist/web-app`. The only package that imports react-router         |
| `tui`           | Terminal dashboard, an HTTP client of the daemon. Bundled into `cli`                                                                  |
| `domains`       | Shared domain layer: schemas, types, requests, labels, mocks and router-free components, see [its README](packages/domains/README.md) |
| `design-system` | Tailwind tokens and styles, shadcn/radix components and generic layout pieces                                                         |
| `utils`         | Business-agnostic helpers that more than one package uses: http, error, date-time and hooks                                           |
| `e2e`           | Playwright config and fixtures. The specs live next to the pages as `*.e2e.ts`                                                        |

## Package manager

pnpm 11 and Node 24, with one lockfile at the root. Versions that several packages use live in the catalog in `pnpm-workspace.yaml`. A package imports another workspace package only after it declares it as `"<name>": "workspace:*"`.

## Commands

Run them from the repo root.

```bash
pnpm install
pnpm build                         # packages/cli/dist/cli.js and the dashboard in packages/cli/dist/web-app
pnpm validate                      # format check, lint, typecheck and unit tests
pnpm test:e2e                      # Playwright against a real daemon from this checkout
pnpm --filter e2e run web-app:ui   # the same in Playwright's UI mode
pnpm cli <command>                 # the CLI from source, with this checkout as the routines folder
```

`pnpm dev`, `pnpm cli install` and `pnpm cli uninstall` take over, rewrite or remove the launchd daemon of this Mac. Run them only when asked.

The checkout scripts (`cli`, `serve`, `dev`, `tui` and their `:local` variants) stay in the root `package.json`. pnpm runs a script in its own package folder, and the CLI treats the nearest folder with a `package.json` as the routines folder, the launchd working directory and the folder it pulls.

To release, bump `version` in `packages/cli/package.json` and run `pnpm --filter @danilqa/kombinat publish`.

## Architecture

### Dependency rules

Packages, bottom to top: `utils` → `design-system` → `domains` → `web-app` and `tui` → `cli`. A package imports only the packages below it, by name. `e2e` is tooling beside them: it imports `domains` and reaches `packages/cli` by relative path.

- `domains` and `utils` never import `cli`, its config, env, `node:*` or react-router.
- Only `web-app` imports react-router, so components that link or navigate stay there: the app header, breadcrumbs, runs table, week calendar and the pages.
- `cli` and `tui` never import React, `design-system`, domain components or `utils/hooks`. They do import the rest of `domains` and `utils`, so there only `components/` and `hooks/` use React.
- Browser code never imports `node:*`. Tests and `vite.config.ts` may.
- Specs import `test` and `expect` only from `e2e/web-app`, and only `packages/e2e` imports `@playwright/test`. Mocks are imported only from `*.test.ts`, `*.e2e.ts` and `packages/e2e`.

`no-restricted-imports` blocks in `eslint.config.js` enforce these rules and the domain orders below. They check static imports only, not `await import()`. In `cli`, which has `domains/` and `utils/` folders of its own, they also miss a relative import of the `domains` and `utils` packages.

### Domains

Each domain has up to two halves with the same name:

- `packages/domains/<domain>`: the shared half that every app needs.
- `packages/cli/src/domains/<domain>`: the daemon half, with files, child processes and config.

Each half has an order of levels. A domain imports only the domains on the levels before its own, never one on its own level. Any daemon domain may import any shared domain.

- Shared: `agent`, `transcript`, `scheduler` and `daemon`, then `run`, then `routine` and `calendar`.
- Daemon: `agent`, then `routine`, then `run`, then `scheduler` and `calendar`.

A shared domain can have `types.ts`, `schemas.ts` (zod), `requests.ts` (each request takes the `HttpClient` first), `constants.ts`, `utils.ts`, `mocks.ts` and `components/`. Inside `packages/domains`, files import each other by relative path. Other packages import them per file, such as `domains/run/utils`, and import components through the domain's barrel, `domains/run/components`. When a domain gets its first component, add `components/index.ts` and its key in `exports` in `packages/domains/package.json`.

The domain map, definitions and invariants are in [packages/domains/README.md](packages/domains/README.md).

### cli

- `src/cli.ts` holds the commands and `src/server.ts` the HTTP API and read models. `src/config.ts` stays one folder below the package root, which it finds from its own location.
- `src/domains/` holds the daemon halves, `src/features/` connect, launchd, readme and self-update, and `src/utils/` cron and json.
- `bin/kombinat.js` runs `src/cli.ts` through tsx in a checkout and `dist/cli.js` when installed from npm. esbuild bundles the workspace packages and keeps only zod and ts-pattern external. An npm package that bundled code imports at runtime must be a `cli` dependency, on the esbuild external list and in the CI check of `dist/cli.js` imports.

### web-app

- `src/app.tsx`, `app-providers.tsx` and `app-routes.tsx` make the shell. Route patterns and path helpers live in `src/constants/path.ts`.
- Pages live in `src/features/<feature>/` next to their `.e2e.ts` specs. Files in a feature folder import each other by relative path; other imports inside `web-app` use the `@web-app/*` alias.
- `src/index.css` imports the design-system stylesheet and adds `@source` for `domains`, so Tailwind sees the classes of domain components.

### design-system

- Other packages import it through three barrels, `design-system/components`, `design-system/layouts` and `design-system/icons`, plus `design-system/utils` and `design-system/styles.css`. Inside the package, a file imports the file it needs by relative path, such as `import * as Tooltip from './tooltip'`, never a barrel.
- To add a shadcn component, run the shadcn CLI in `packages/design-system`, where `components.json` is; its aliases resolve through the tsconfig paths there. Then rewrite the generated `design-system/...` imports to relative paths, as in the other files, then name the props interfaces `<Function>Props`, end the file with an export block as described in Code style and add it to `components/index.ts`.

## Code style

- File names are kebab-case. Object types are interfaces. No enums, no switch (use ts-pattern `match`) and no inline type literals. A component's props interface is `<Component>Props`. ESLint enforces these.
- A component made of parts is a namespace, as in Radix. Its file keeps full names, `TableRow` with `TableRowProps`, and ends with `export { Table as Root, TableRow as Row }`. The folder's `index.ts` re-exports it with `export * as Table from './table'`, and callers write `<Table.Root>` and `<Table.Row>`. A component of one part keeps its name: `export * from './badge'`. Domain components follow the same rule.
- Unit tests sit next to their code as `*.test.ts` and run on node:test through tsx. `pnpm test` runs the tests of every package.
- Do not write comments by default. Write one short line only for a "why" the code cannot say.
