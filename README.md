# Kombinat

Coding agent routines defined in this repo instead of a desktop UI. They run on your Mac under launchd with Claude Code, Codex or any other CLI agent, using your normal subscription login.

## Routines

Times are Europe/London. Each row is a file in [`routines/`](routines/), the table comes from `pnpm cli readme`.

<!-- prettier-ignore-start -->
<!-- routines:start -->
| Routine | When | What it does |
| - | - | - |
| [smoke-test](routines/smoke-test.md) | Manual | Say hi |
<!-- routines:end -->
<!-- prettier-ignore-end -->

## How it works

- `routines/*.md`: one file per routine. YAML frontmatter for the schedule and settings, markdown body is the prompt.
- `pnpm cli serve`: a small daemon. Every 30s it checks which routines are due and starts the routine's agent for each (`claude -p`, `codex exec` or your own command). It also serves a dashboard at http://localhost:7433.
- launchd keeps the daemon alive and restarts it after reboot or login. Runs only happen while the Mac is awake and you are logged in (the keychain has to be unlocked).
- Run logs and history live in `~/.kombinat/` (outside the repo).

No API key anywhere. `claude -p` and `codex exec` read the same login you use in the terminal. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `CODEX_API_KEY` are dropped from the run env on purpose.

## Setup

Needs Node 24 and pnpm, plus the agents your routines use:

- Claude Code at `~/.local/bin/claude` (or set `CLAUDE_BIN`), logged in (`claude auth status`).
- Codex on the `PATH` (or set `CODEX_BIN`), logged in (`codex login`).

```bash
pnpm install
pnpm ui:build
pnpm cli install
```

That writes `~/Library/LaunchAgents/com.kombinat.daemon.plist` and starts the daemon. Open http://localhost:7433.

Handy commands:

```bash
pnpm cli tui               # keyboard dashboard in the terminal, handy over ssh
pnpm cli list              # routines, agent, next run, last status
pnpm cli validate          # check every routine file
pnpm cli readme            # refresh the routines table in this README
pnpm cli run smoke-test    # run one routine now, in the foreground
pnpm cli status            # launchd + scheduler state
pnpm cli uninstall
pnpm validate              # format check, lint, typecheck and tests
```

The TypeScript runs through `tsx`, so plain `node src/cli.ts` does not work.

## Updating

You don't have to. Every 5 minutes the daemon runs `git pull --ff-only origin main`, so a merged PR is live on the Mac a few minutes later. It only pulls when the checkout is on `main` with no local changes, and it says so in `daemon.log` when it skips. `pnpm cli pull` does one pull by hand.

After a pull (or your own edits):

- routine files are re-read every tick
- a change under `src/` makes the daemon exit and launchd starts it again with the new code
- a change under `ui/src` rebuilds the dashboard in place
- a change to the lockfile runs `pnpm install`, then restarts

A run in progress is a separate process, so a restart never interrupts it. `KOMBINAT_PULL_MINUTES=0` turns the auto-pull off, `KOMBINAT_PULL_BRANCH` changes the branch.

## Hacking on it

```bash
pnpm dev
```

This stops the launchd daemon, runs the scheduler and API from your checkout without the auto-restart, and starts the Vite dev server on http://localhost:5173. Ctrl-C hands everything back to launchd. Add `--no-scheduler` if you only want the UI and no routines should fire from your half-edited tree.

### Code rules

- Dependencies are pinned to exact versions (`saveExact` in `pnpm-workspace.yaml`).
- TypeScript is strict, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- ESLint (`pnpm lint`) runs typescript-eslint's `strictTypeChecked` and bans `any`, every type assertion except `as const` (so no `as unknown as`), non-null assertions, `@ts-` comments, `switch`, `enum` and `===` on string-literal unions (use `ts-pattern`). Inline `eslint-disable` comments are ignored.
- Data from outside the process (run records on disk, agent output, API responses) is parsed with the zod schemas in `src/shared/contract.ts`, which the daemon, the TUI and the web UI share (`@shared/*` in the UI).
- File names are kebab-case, React components included.
- `tsc` is TypeScript 7 (the `typescript7` package). typescript-eslint still needs the TypeScript 6 compiler API, so `typescript` is an alias of `@typescript/typescript6`.

## Writing a routine

```markdown
---
name: fix-e2e-tests
description: Analyses the failed product e2e tests and fixes the broken one
schedule: '30 11 * * *'
cwd: /Users/you/
agent: claude
model: claude-opus-5-5
effort: high
permissionMode: auto
timeoutMinutes: 55
maxBudgetUsd: 20
before: ensure-docker.sh
---

1. Read the action pipeline on GitHub ...
```

- `name` must match the file name.
- `schedule` is a 5-field cron in local time. `manual` means it only runs when you click Run now or call `run`.
- `cwd` is where the agent starts. `~/` works.
- `agent` is `claude` (the default), `codex` or `command`. The other settings depend on it, see below.
- `timeoutMinutes` sends Ctrl-C to the run when it is over time. Default 55.
- `before` is a shell command that runs first, in `cwd`, with `scripts/` on the PATH. If it fails or takes over 3 minutes the run is marked failed and the agent never starts.
- `enabled: false` keeps the file but stops the schedule.

Edits take effect on the next tick, no restart needed. Write prompts as if nobody will ever answer a question, because nobody will.

### Agents

| Setting          | `claude`                                                                          | `codex`                                                        | `command` |
| ---------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------- |
| `model`          | default `claude-opus-5-5`                                                         | default from your Codex config                                 | -         |
| `effort`         | `low`, `medium`, `high` (default), `xhigh`, `max`                                 | `minimal`, `low`, `medium`, `high`, `xhigh`                    | -         |
| `permissionMode` | `auto` (default), `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan`, `manual` | `read-only`, `workspace-write` (default), `danger-full-access` | -         |
| `maxBudgetUsd`   | optional                                                                          | -                                                              | -         |
| `command`        | -                                                                                 | -                                                              | required  |

- `claude` runs `claude -p` with `--permission-prompts none`, so anything that would need a human is denied, never blocked.
- `codex` runs `codex exec --json`, and `permissionMode` is its sandbox. It never asks for approval in `exec`.
- `command` runs any other CLI agent: `command: gemini --yolo` is started with `/bin/sh -c` in `cwd`, gets the prompt on stdin, and its output becomes the result. `KOMBINAT_ROUTINE`, `KOMBINAT_RUN_ID` and `KOMBINAT_TRIGGER` are set for it.

A setting the agent does not support fails validation instead of being ignored.

## Missed runs

If the Mac was asleep, the daemon runs each routine once for the latest missed slot (up to 7 days back) and marks it `catch_up`. A routine never overlaps itself: if it is still running when the next slot comes, that slot is skipped and shown on the dashboard. At most 3 runs go in parallel (`KOMBINAT_MAX_CONCURRENT`).

## Dashboard

The week calendar at the top shows what ran and what is planned. Past blocks are real runs coloured by status, future blocks come from each routine's cron and are as long as the routine's typical run (or 20 minutes when it has never run). Routines that would run at the same time sit side by side and are counted in the "overlaps" chip. The daemon allows 3 runs in parallel, so an overlap is not a problem by itself, just worth knowing.

`pnpm ui:build` puts the static build into `ui/dist`, which the daemon serves. The daemon does this itself when the sources are newer than the build.

Each run keeps the agent's full output in `~/.kombinat/runs/<routine>/<run-id>.jsonl`, and the dashboard turns it into a transcript with every tool call. The session id is stored too, so the run page shows how to pick it up in your terminal (`claude --resume <session-id>` or `codex resume <session-id>`).

## Terminal UI

`pnpm cli tui` (or `pnpm tui`) is the same dashboard minus the calendar, for when you ssh into the Mac. It talks to the running daemon on `localhost:7433`, so "run now" is started by the launchd daemon (which has the unlocked keychain), not by your ssh session. If the daemon is down it says so and keeps retrying.

Left side: daemon status, routines, recent runs. Right side: whatever is selected, so a routine with its runs, prompt and skipped slots, or a run with its result and the full transcript. Running runs refresh every 3 seconds; press `G` on one to follow it.

| Keys                                      | What                                                                |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `↑` `↓` or `j` `k`                        | move                                                                |
| `enter` `l` `→`                           | open, or expand a tool call in a transcript                         |
| `esc` `h` `←`                             | back                                                                |
| `tab`, `1` `2` `0`                        | switch panel: routines, runs, detail                                |
| `g` `G`, `ctrl-d` `ctrl-u`, `pgup` `pgdn` | jump around (`G` follows a running run)                             |
| `[` `]`                                   | routine tabs: runs, prompt, skipped                                 |
| `{` `}`, `e`                              | previous / next transcript item, expand or collapse every tool call |
| `r`                                       | run the selected routine now (asks first)                           |
| `R`                                       | refresh now                                                         |
| `?`, `q`                                  | help, quit                                                          |

It needs a terminal of at least 60x16 and looks best at 140 columns or more.

## Env

| Variable                  | Default               | What                                   |
| ------------------------- | --------------------- | -------------------------------------- |
| `KOMBINAT_PORT`           | `7433`                | dashboard port                         |
| `KOMBINAT_STATE_DIR`      | `~/.kombinat`         | logs and history                       |
| `KOMBINAT_ROUTINES_DIR`   | `./routines`          | routine files                          |
| `KOMBINAT_MAX_CONCURRENT` | `3`                   | parallel runs                          |
| `KOMBINAT_TICK_SECONDS`   | `30`                  | scheduler interval                     |
| `KOMBINAT_PULL_MINUTES`   | `5`                   | auto `git pull` interval, 0 to disable |
| `KOMBINAT_PULL_BRANCH`    | `main`                | branch the daemon pulls and stays on   |
| `CLAUDE_BIN`              | `~/.local/bin/claude` | claude binary                          |
| `CODEX_BIN`               | `codex`               | codex binary, looked up on the `PATH`  |

Set them before `pnpm cli install`, they get baked into the plist.

For testing on a laptop, copy `.env.local.example` to `.env.local` and set what you need there, e.g. `CLAUDE_BIN` for a Homebrew install. Then use the `:local` scripts, which load it: `pnpm cli:local <command>`, `pnpm dev:local`, `pnpm serve:local`, `pnpm tui:local`. The other scripts and the agents Mac never read it.
