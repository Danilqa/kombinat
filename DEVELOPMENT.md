# Development

```bash
git clone https://github.com/Danilqa/kombinat.git && cd kombinat
pnpm install
pnpm dev        # run the daemon and the dashboard from this checkout
pnpm validate   # format, lint, typecheck and tests
pnpm test:e2e   # dashboard tests in Chromium
```

`pnpm test:e2e` starts a daemon from this checkout with temporary routines and state, so the running daemon is not touched. Install the browser once with `pnpm --filter e2e exec playwright install chromium`.

`pnpm dev` pauses the launchd daemon until you press Ctrl-C. Add `--no-scheduler` to stop routines from running while you work. If the daemon runs another folder, the scheduler stays off anyway, and its routines catch up when it is back.

A checkout also works as a routines folder of its own: use `pnpm cli <command>` where the README says `pnpm kombinat`. Then code changes restart the daemon and UI changes rebuild the dashboard. To try it on a laptop, put the variables in `.env.local` (see `.env.local.example`) and use the `:local` scripts, for example `pnpm cli:local list`.

The code is a pnpm workspace in `packages/`: the CLI and daemon in `packages/cli`, the dashboards in `packages/web-app` and `packages/tui`, the demo site in `packages/website`, and the packages they share. [AGENTS.md](AGENTS.md) describes each package and the rules between them.

A daemon installed from a checkout before the move to `packages/` still starts the temporary root `bin/kombinat.js`. Run `pnpm cli install` once, so that it starts `packages/cli/bin/kombinat.js`.

To publish a release, bump `version` in `packages/cli/package.json` and run `npm publish` in `packages/cli`. It builds the CLI and the dashboard first.
