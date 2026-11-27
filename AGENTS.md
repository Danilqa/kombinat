# AGENTS.md

Kombinat runs routines, markdown files in `routines/`, with AI agents on a schedule under launchd or systemd. This repo is a pnpm workspace: the published CLI and daemon, the browser and terminal dashboards, and the packages they share. `example/` is a routines folder with the example routines of `kombinat init`.

## Packages

| Package         | Description                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cli`           | `kombinat`, the only published package: CLI commands and the daemon                                                                                                                  |
| `web-app`       | Browser dashboard (React, Vite, Tailwind), built into `packages/cli/dist/web-app`                                                                                                    |
| `tui`           | Terminal dashboard, an HTTP client of the daemon. Bundled into `cli`                                                                                                                 |
| `website`       | Demo of the browser dashboard with sample data, deployed to GitHub Pages at https://kombinat.tech/                                                                                   |
| `domains`       | Shared domain layer in pure TypeScript: schemas, types, requests, labels and mocks, see [its README](packages/domains/README.md)                                                     |
| `design-system` | Tailwind tokens and styles, and the components that know no domain: shadcn/radix and generic layout pieces                                                                           |
| `utils`         | Business-agnostic helpers that more than one package uses: api, error, date-time, cron and search                                                                                    |
| `e2e`           | Playwright config and fixtures. The specs live in `web-app` as `*.e2e.ts`, next to the page or component they cover                                                                  |
| `storybook`     | Storybook of the design-system components, deployed with the website at https://kombinat.tech/storybook/                                                                             |
| `promo`         | Source of the promo video and the README's dashboard GIF: scenes drawn with React, tours of the website and the scripts that record them, see [its README](packages/promo/README.md) |

## Package manager

pnpm 11 and Node 24, with one lockfile at the root. Versions that several packages use live in the catalog in `pnpm-workspace.yaml`. A package imports another workspace package only after it declares it as `"<name>": "workspace:*"`. A package extends the root `tsconfig.json`, or `tsconfig.browser.json` when its code runs in a browser.

## Commands

Run them from the repo root.

```bash
pnpm install
pnpm build                         # packages/cli/dist/cli.js and the dashboard in packages/cli/dist/web-app
pnpm validate                      # format check, lint, typecheck and unit tests
pnpm test:e2e                      # Playwright against a real daemon from this checkout
pnpm --filter e2e run web-app:ui   # the same in Playwright's UI mode
pnpm cli <command>                 # the CLI from source, with example/routines as the routines folder
pnpm --filter website dev          # the demo site at http://localhost:5174/
pnpm --filter design-system-storybook dev   # the Storybook at http://localhost:6006/
pnpm --filter promo record          # the promo video in packages/promo/out, see its README
```

`pnpm dev`, `pnpm cli install` and `pnpm cli uninstall` take over, rewrite or remove the launchd daemon of this Mac. Run them only when asked.

The checkout scripts (`cli`, `serve`, `dev`, `tui` and their `:local` variants) stay in the root `package.json`. pnpm runs a script in its own package folder, and the CLI treats the nearest folder with a `package.json` as the project: the launchd working directory and the folder it pulls. The scripts point `KOMBINAT_ROUTINES_DIR` at `example/routines`, whose files `packages/cli/src/features/init/examples.ts` repeats for `init`.

To release, bump `version` in `packages/cli/package.json` and the `kombinat` version in `example/package.json`, and run `npm publish` in `packages/cli`. npm copies `package.json` as it is, so the `dependencies` of `cli` keep exact versions instead of `catalog:`.

`.github/workflows/ci.yml` runs each check of `pnpm validate`, the website and Storybook builds, the npm package check and the e2e tests as parallel jobs on every PR. The ruleset of `main` requires every job by its name, so a PR merges only once they all pass. When you add or rename a job, update the ruleset too.

## Structure

Every kind of file has one home and one name. There is no folder named `components`, and no catch-all folder for code that merely appears together.

```
packages/
  utils/                          Pure TypeScript that knows no business: api.ts, error.ts, date-time.ts, cron.ts, search.ts.
  design-system/                  UI that knows no domain.
    index.ts                      Re-exports every component and utils.ts. Other packages import `design-system`.
    utils.ts                      `cn` and the hooks the components share.
    styles/index.css              The Tailwind entry: tokens, base styles and custom utilities.
    <component>/                  One folder per component.
  domains/                        Pure TypeScript. No React.
    <domain>/                     ids.ts, types.ts, schemas.ts, requests.ts, constants.ts, utils.ts, mocks.ts.
  web-app/src/                    The browser dashboard.
    main.tsx  app.tsx  app-providers.tsx  app-routes.tsx
    api.ts                        The ky client of the daemon's API.
    query-keys.ts                 The root query keys and the keys each kind of change invalidates.
    polling.ts  paths.ts  customization.ts
    layout/                       The shell around the pages: app-header/, app-footer/, search-dialog/, breadcrumbs/, nav-items.ts.
    hooks/                        Hooks that know no domain.
    domains/<domain>/
      queries.ts                  The React Query hooks around the domain's requests.
      <component>/                One folder per component that knows the domain.
    pages/                        One file per route, next to its spec: routines.tsx, routines.e2e.ts.
  tui/src/                        The terminal dashboard.
    index.ts  daemon-client.ts  page-content.ts
    app.ts  app-*.ts              The shell and its pieces: types, bottom bar, help popup, copyright.
    pages/                        routine-page.ts, run-page.ts.
    domains/<domain>/             What the terminal draws of a domain.
    terminal/                     The layer under them all.
  cli/src/                        The CLI and the daemon.
    cli.ts  server.ts  config.ts
    api/                          routes.ts, response.ts and one file of handlers and read models per domain.
    domains/<domain>/             The daemon half of a domain.
    features/<feature>/           What the cli does that is not a domain.
    utils/
  website/src/                    The demo site.
    main.tsx  constants.ts
    pages/  domains/<domain>/  layout/
    demo-api/                     The daemon's API, answered in the browser.
  promo/                          The promo video: src/ draws it, scripts/ record it.
  storybook/                      The Storybook of design-system: .storybook/ configures it, stories/ shows the components.
  e2e/web-app/                    playwright.config.ts, index.ts and fixtures/.
```

### A component folder

```
run-status-badge/
  index.ts                        export * from './run-status-badge'
  run-status-badge.tsx
  <part>.tsx                      A part only this component uses.
  run-status-badge.e2e.ts         Its spec, when it has one.
```

A part that two components use gets a folder of its own.

### Where a new thing goes

- A component that knows no domain goes in `design-system`. One that knows a domain goes in that domain's folder in `web-app`, the domain whose request or type it is built on, not the page it appears on.
- A request goes in `packages/domains/<domain>/requests.ts`, and its hook in `packages/web-app/src/domains/<domain>/queries.ts`. Only `queries.ts` files call the requests and React Query, and only `utils/api.ts` imports ky: every client comes from its `createApi`.
- A page puts domains together, so it goes in `pages/`, and what surrounds every page goes in `layout/`.
- A rule or a label that the daemon, the TUI and the dashboard share goes in `packages/domains/<domain>/utils.ts`.
- A new domain gets a folder in `packages/domains`, and one in `cli`, `web-app` or `tui` only once that app has code for it.

## Architecture

### Dependency rules

Packages, bottom to top: `utils` → `design-system` → `domains` → `web-app` and `tui` → `cli` and `website`. A package imports only the packages below it, by name. `e2e` is tooling beside them: it imports `domains` and reaches `packages/cli` by relative path. `promo` is tooling too: its scenes import `design-system`, and it records the website from its build, never by import. So is `storybook`, which imports only `design-system`.

- `domains` and `utils` never import `cli`, its config, env, `node:*`, react-router or React. `domains` never imports `design-system`.
- Only `web-app` and `website` import react-router.
- `cli` and `tui` never import React, React Query or `design-system`.
- Browser code never imports `node:*`. Tests and `vite.config.ts` may.
- Specs import `test` and `expect` only from `e2e/web-app`, and only `packages/e2e` imports `@playwright/test`. Mocks are imported only from `*.test.ts`, `*.e2e.ts` and `packages/e2e`.

`no-restricted-imports` blocks in `eslint.config.js` enforce these rules, the domain orders and the layers inside each package below. They check static imports only, not `await import()`. In `cli`, which has `domains/` and `utils/` folders of its own, they also miss a relative import of the `domains` and `utils` packages. `tui` and `website` have a `src/domains/` too, so there the rule goes by how far a path climbs, and in `website` it misses the files right in `src/`.

### Domains

A domain lives in up to four folders with the same name:

- `packages/domains/<domain>`: the shared half that every app needs.
- `packages/cli/src/domains/<domain>`: the daemon half, with files, child processes and config.
- `packages/web-app/src/domains/<domain>`: the dashboard's hooks and components.
- `packages/tui/src/domains/<domain>`: what the terminal draws.

Each has an order of levels. A domain imports only the domains on the levels before its own, never one on its own level. Any daemon, dashboard or terminal domain may import any shared domain.

- Shared, and the same in `web-app` and `tui`: `agent`, `transcript`, `scheduler`, `daemon`, `webhook`, `settings` and `release`, then `run`, then `routine`, `calendar`, `inbox` and `insights`. Besides, a shared domain may import the `ids.ts` of any other, which imports only zod.
- Daemon: `agent`, `settings`, `inbox` and `release`, then `routine`, then `run`, then `webhook`, then `scheduler`.

A shared domain can have `ids.ts`, `types.ts`, `schemas.ts` (zod), `requests.ts` (each request takes the `Api` of `utils/api` first), `constants.ts`, `utils.ts` and `mocks.ts`. `routine` also has `templates.ts`, the ready routines of New routine. Inside `packages/domains`, files import each other by relative path. Other packages import them per file, such as `domains/run/utils`.

The domain map, definitions and invariants are in [packages/domains/README.md](packages/domains/README.md).

### cli

- `src/cli.ts` parses the arguments and dispatches the commands. `src/server.ts` is the HTTP transport and the daemon's wiring. `src/config.ts` stays one folder below the package root, which it finds from its own location.
- `src/api/` is the HTTP API: `routes.ts` is the route table, `response.ts` the answers and the lookups of a routine and a run, and each other file holds the handlers and read models of one domain. It imports the domains and the features, and `server.ts` serves it. Domains and features never import `api/`, `server.ts` or `cli.ts`, and a domain never imports a feature.
- `src/domains/` holds the daemon halves, `src/features/` connect, init, keep-awake, live-updates, login, machine-usage, readme, self-update and service, and `src/utils/` json and package-manager.
- In a daemon domain, `storage.ts` reads and writes the domain's JSON state files, `mocks.ts` holds builders for tests, and every other file is named after what it does: `runner.ts` runs inside the `kombinat run` process, `launcher.ts` starts and tracks those processes from the daemon.
- `bin/kombinat.js` runs `src/cli.ts` through tsx in a checkout and `dist/cli.js` when installed from npm. esbuild bundles the workspace packages and ky, and keeps only zod and ts-pattern external. An npm package that bundled code imports at runtime must be a `cli` dependency, on the esbuild external list and in the CI check of `dist/cli.js` imports.

### web-app

- `src/app.tsx`, `app-providers.tsx` and `app-routes.tsx` make the shell. `App` takes an optional `customization` that the layout and the pages read with `useCustomization()` from `src/customization.ts`, so an embedding app such as `website` can fill the slots around the pages and change their text. Route patterns and path helpers live in `src/paths.ts`.
- Server data comes through React Query. `src/api.ts` is the ky client, a request is a function of `domains/<domain>/requests`, and its hook lives in `src/domains/<domain>/queries.ts`: only those files call the requests, `useQuery` and `useMutation`. A query key starts with the API path, such as `['routines', name]` for `/api/routines/<name>`. Queries poll with `refetchInterval`, and a mutation invalidates the keys of all the data it changes, which `src/query-keys.ts` lists. `useLiveUpdates` invalidates every query each time the daemon's `GET /api/events` stream reports a change, and follows the stream only while the tab is visible. The polls stay as the fallback for when the stream is down.
- A page in `src/pages/` puts the components of several domains together, and `src/layout/` is the shell around the pages. A domain never imports a page, the layout or the app files. `queries.ts` never imports react-router: what follows a mutation, such as opening the new run, is a callback that the caller passes to the hook.
- Imports across folders inside `web-app` use the `@web-app/*` alias and go through barrels, so one line brings several things: a domain's components come from its `components.ts`, such as `import { RetryCard, RunChat } from '@web-app/domains/run/components'`, its hooks from `queries.ts` and its `use-*.ts` files, and the rest from `@web-app/hooks`, `@web-app/layout` and `@web-app/pages`. Inside one domain, folders import each other by relative path, such as `../run-duration` and `../queries`, never their own barrel, and so do the files of `hooks/`, `layout/` and `pages/`. A new component folder goes into the `components.ts` of its domain, which the domain's first component creates.
- `src/index.css` imports the design-system stylesheet. Tailwind scans the package, so every class lives in `web-app` or `design-system`.
- `public/` makes the dashboard an installable app: the manifest, the icons and `sw.js`, the service worker that `src/main.tsx` registers in the build. It answers only page loads, with `offline.html` when the daemon is unreachable, and caches nothing else. It also opens the run of a notification that is clicked. The edges of the layout pad by `env(safe-area-inset-*)`, since the app draws under the iPhone's status bar.

### tui

- `src/index.ts` starts the terminal with `runTui`, and `src/app.ts` is the shell: `TuiApp` holds the state, handles the keys and lays out the panels. Its types, bottom bar, help popup and copyright line are the `app-*.ts` files next to it. `src/daemon-client.ts` reads the daemon through the domain requests, and `src/page-content.ts` holds the lines of the detail panel with their actions.
- `src/pages/` composes the routine and the run page from `src/domains/<domain>/`, which holds what the terminal draws of each domain: rows, tables, headers and popups. A domain never imports the app or a page.
- `src/terminal/` is the layer under them all and imports nothing else of `tui`: key parsing, spans and lines with their widths, the theme, markdown, and the generic drawing pieces, the box, the columns, the detail rows and the section title.
- Every import inside `tui` is a relative path.

### website

- `src/main.tsx` renders the web-app's `App`, exported as `web-app/app`, with this `customization`: the star bar of `src/layout/star-bar/` as the `announcement` above the header, the swipeable cards of `src/layout/welcome-banner/` as the `banner` under the header of the routines page, the copyright of `src/layout/site-footer/` with a link to the changelog as the `footer`, the changelog page of `src/pages/changelog.tsx` in `routes`, and "Demo routines" as the `routinesTitle` heading of that page. The build copies `index.html` to `404.html` so that GitHub Pages opens deep links.
- It imports the web-app only through its package exports: `web-app/app`, `web-app/paths`, `web-app/hooks` and `web-app/layout`. Every import inside the website is a relative path, through the barrels `layout/index.ts` and `domains/release/components.ts` as in the web-app.
- `src/demo-api/` answers the dashboard's `/api` requests in the browser, as `cli/src/api/` does: `install.ts` puts it in front of `fetch`, `api.ts` holds the state and the route table, and `history.ts` builds runs and skips from the schedules relative to now. `sample/` holds the sample data: one file per routine in `routines/`, with its run outcomes and transcripts, the types, the values several routines share and the builders of transcript steps.
- `public/og-image.gif` is the link preview image. `index.html` names it by its full URL in the Open Graph tags, since apps that unfurl links do not resolve relative paths.
- The changelog page reads the releases from the GitHub API in the browser, so a new release shows there without a deploy, and draws them with the components of `src/domains/release/`. Only the website has it: the dashboard shows newer releases in its update card.
- `.github/workflows/website.yml` deploys it on every push to `main`, with the Storybook build copied into `dist/storybook/`.

### storybook

- `stories/` holds one `<component>.stories.tsx` for each folder of `design-system`, titled `Components/<Component>`, and the token pages under `Foundations/`. A new design-system component gets its stories here.
- Stories import the components from `design-system`, like any other package. Docs pages come from the components' props, so a story sets `component`, and `subcomponents` for the parts of a namespace.
- `.storybook/preview.css` imports the design-system stylesheet and scans `stories/` for the classes of the stories. `.storybook/theme.ts` repeats the dashboard's tokens for Storybook's own UI, which the stylesheet does not reach, and `public/kombinat-logo.svg` is the logo of its sidebar.
- The build goes to `dist/`, which the website workflow publishes at `/storybook/`.

### promo

- `src/timeline.ts` lists the video's segments with their lengths. Each scene is a folder in `src/scenes/` that draws one moment from `time`, and `scripts/record.ts` seeks it frame by frame, so the video is the same on every machine. The dashboard tour in `scripts/capture-tour.ts` clicks through the built website in real time.
- A piece that one scene draws lives in that scene's folder. A piece that several draw has a folder named after what it draws: `code-window/`, `heading/`, `routine-card/`, `avatar/` and `flow-arrow/`.
- `src/narration.ts` is the voiceover script. Its takes come from Fish Audio by hand, and `scripts/voice.ts` brings them to one pace before `record` lays them over the video.
- The recording goes to `packages/promo/out/`, which git ignores. The video is published by hand, not from CI.
- `pnpm --filter promo readme-gif` records `scripts/readme-tour.ts` into `.github/assets/dashboard.gif`, the GIF of the root README.

### design-system

- Other packages import everything from `design-system`, and the stylesheet as `design-system/styles.css`. Inside the package, a component imports another by its folder, such as `import { Tooltip } from '../tooltip'`, never the root barrel or the package name.
- `styles/index.css` is the only place that defines tokens: colours, radii, text styles, shadows, the page width and animations. A literal token goes in the plain `@theme`, and one that points at another variable in `@theme inline`. The website's stylesheet adds only the animations of its banner.
- A class uses a token, not a raw colour or a repeated arbitrary value: `max-w-page`, `bg-brand-violet`, `shadow-stripe-negative`. Write the canonical form Tailwind has for a value, `size-4.5` rather than `size-[18px]`. The root font size is 14px, so a rem-based step such as `max-w-3xl` is not the px value its name suggests.
- `cn` in `utils.ts` merges classes. Its `extendTailwindMerge` config lists the custom names that can conflict with a Tailwind class: the text sizes, shadows, easings, animations and container of `@theme`, and the `top-below-*` utilities. Add a new one of these there too. The stylesheet leaves `utils.ts` out of the class scan.
- `prettier-plugin-tailwindcss` sorts the classes, in `className` and in the calls of `cn` and `cva`, so `pnpm format:check` fails on another order.
- The base layer owns the focus ring and the outline of forced colours, so an element does not take `outline-none`, except one that scripts focus without a ring, such as `main`. The app is dark only, and `<html>` carries `class="dark"` for the `dark:` classes of generated shadcn code.
- `Card.Root` has no padding or gap of its own. A status dot is a `StatusDot`, or a `PingingStatusDot` where it can ping, with the tone that `getRunStatusTone` of `domains/run/utils` gives a run. A phone tap target that is smaller than 44px takes `tap-area`.
- To add a shadcn component, run the shadcn CLI in `packages/design-system`, where `components.json` is; its aliases resolve through the tsconfig paths there. It writes `<name>.tsx` at the package root. Move it into `<name>/<name>.tsx` with an `index.ts`, rewrite the generated `design-system/...` imports to relative ones, such as `../utils`, name the props interfaces `<Function>Props`, end the file with an export block as described in Code style and add the folder to the root `index.ts`.

## Code style

- File names are kebab-case. Object types are interfaces. No enums, no switch (use ts-pattern `match`) and no inline type literals. A component's props interface is `<Component>Props`. ESLint enforces these.
- A function or method that returns a boolean is named `check<…>`, not `get<…>` or `is<…>`: `checkIsTickStale`, `checkHasRunningRun`, `tunnel.checkIsOpen()`, type guards too. Its result goes into an `is…` or `has…` variable. A function that does work and returns whether it succeeded keeps its verb, such as `buildWebApp`.
- A component made of parts is a namespace, as in Radix. Its file keeps full names, `TableRow` with `TableRowProps`, and ends with `export { Table as Root, TableRow as Row }`. The folder's `index.ts` re-exports it with `export * as Table from './table'`, and callers write `<Table.Root>` and `<Table.Row>`. A component of one part keeps its name: `export * from './badge'`. Domain components follow the same rule.
- An id is a branded zod type from the `ids.ts` of the domain it names, such as `RoutineName` from `domains/routine/ids` or `RunId` from `domains/run/ids`, never a plain `string`. A string becomes an id only through its schema's `parse`, where it comes in: a file, a URL, a CLI argument, an agent's output or a test.
- Unit tests sit next to their code as `*.test.ts` and run on node:test through tsx. `pnpm test` runs the tests of every package.
- Do not write comments by default. Write one short line only for a "why" the code cannot say.
