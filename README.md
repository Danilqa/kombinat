<img src=".github/assets/banner.png" alt="Kombinat: routines in your repo, run by AI agents 24/7" width="100%" />

Background AI agents that run routines defined in your repository, 24/7. They run on your machine under launchd with Claude Code, Codex or any other CLI agent, using your normal subscription login.

Ready to use in your organisation or at home.

**Quickstart:**

1. Get the code. You need macOS, Node 24, pnpm and Claude Code or Codex, logged in. Kombinat looks for Claude Code at `~/.local/bin/claude`. If yours is elsewhere, set `CLAUDE_BIN`.

   ```bash
   git clone https://github.com/Danilqa/kombinat.git && cd kombinat
   pnpm install
   ```

2. Start the scheduler. The first start also builds the dashboard.

   ```bash
   pnpm serve
   ```

   It runs in this terminal. To keep it running in the background and after reboots, stop it and run `pnpm cli install` instead, see [Setup](#setup).

3. Add your routines as `.md` files in [`routines/`](routines/), see [Writing a routine](#writing-a-routine). Changes are picked up on the next check, no restart needed. Agents run with your usual setup, so your global skills, MCP servers and `CLAUDE.md` are picked up.

4. Monitor and debug runs in the dashboard at http://localhost:7433, or in the terminal with `pnpm cli tui`, which also works over ssh. See [Monitoring](#monitoring).

**Why Kombinat:**

1. **Version-controlled routines.** Merge a `.md` file and the change is picked up automatically.
2. **Minimal and lightweight.** Run one command on a machine that is on 24/7.
3. **Your own integrations.** Agents use your local environment as is, including skills, browser control and more.
4. **Cheap.** Works with your existing Claude or Codex subscription.

**Ideas to get you started:**

1. **Post-release monitoring.** Checks Intercom, Sentry, Grafana and the logs for problems in code shipped over the last 3 days, raises an alert and opens PRs with fixes.
2. **On-call engineer.** Investigates production incidents and opens PRs to fix them.
3. **Flaky E2E test fixer.**
4. **Dead code and feature flag clean-up.**

## Monitoring

<img src=".github/assets/dashboard.png" alt="Kombinat dashboard: routines list, week calendar and a run transcript" width="100%" />

The daemon serves a dashboard at http://localhost:7433.

- **Routines.** Every routine with its schedule in plain words, agent and model, next run and last result. Start any routine with Run now.
- **Calendar.** A week of past runs coloured by status and the planned runs from each schedule, so you can spot gaps and routines that overlap.
- **Runs.** The latest runs across all routines. A run page shows the result, every tool call in the transcript and, for Claude and Codex, the command to resume the session in your terminal.
- **Daemon status.** The top bar shows whether the scheduler is ticking and how many routines are running.

### In the terminal

<img src=".github/assets/tui.png" alt="Kombinat in the terminal: routines, recent runs and a routine's run history" width="100%" />

`pnpm cli tui` shows the same in the terminal, without the calendar. It works over ssh. Press `?` for keys.

## Routines

Each row is a file in [`routines/`](routines/). `pnpm cli readme` updates this table.

<!-- prettier-ignore-start -->
<!-- routines:start -->
| Routine | When | What it does |
| - | - | - |
| [weather-example-routine](routines/weather-example-routine.md) | Weekdays at 08:00 | Says if you need an umbrella today |
<!-- routines:end -->
<!-- prettier-ignore-end -->

## How it works

- Each routine is a markdown file. The frontmatter sets the schedule and settings, the body is the prompt.
- A small daemon checks every 30 seconds which routines are due and starts their agent. It also serves a dashboard at http://localhost:7433.
- launchd keeps the daemon running and starts it again after a reboot. Runs only happen while the Mac is awake and you are logged in.
- Logs and run history are stored in `~/.kombinat/`.
- Claude and Codex use your subscription login. API key variables are removed from their environment.

## Setup

You need Node 24, pnpm and the agents your routines use, logged in: Claude Code (`claude auth status`) and Codex (`codex login`).

```bash
pnpm install
pnpm cli install
```

This starts the daemon under launchd. It builds the dashboard on the first start. Open http://localhost:7433.

## Commands

```bash
pnpm cli list           # routines, next run, last status
pnpm cli run <name>     # run a routine now, in the foreground
pnpm cli validate       # check all routine files
pnpm cli tui            # dashboard in the terminal, works over ssh
pnpm cli status         # daemon and scheduler state
pnpm cli readme         # update the routines table above
pnpm cli uninstall      # stop and remove the daemon
```

## Writing a routine

```markdown
---
name: fix-e2e-tests
description: Finds the failing e2e test and fixes it
schedule: '30 11 * * *'
cwd: ~/projects/app
agent: claude
model: claude-opus-5-5
effort: high
timeoutMinutes: 55
---

1. Open the latest failed e2e run on GitHub ...
```

- `name` must match the file name.
- `schedule` is a 5-field cron in local time, or `manual` to run only on demand.
- `cwd` is where the agent starts.
- `agent` is `claude` (default), `codex` or `command`.
- `timeoutMinutes` stops the run after this time. Default 55.
- `before` is an optional shell command that runs first. If it fails or takes more than 3 minutes, the run fails.
- `enabled: false` keeps the file but stops the schedule.

Changes apply on the next check, no restart needed. Write the prompt so the agent never has to ask a question: nobody will answer.

### Agents

| Setting          | `claude`                                                                          | `codex`                                                        | `command` |
| ---------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------- |
| `model`          | default `claude-opus-5-5`                                                         | default from your Codex config                                 | -         |
| `effort`         | `low`, `medium`, `high` (default), `xhigh`, `max`                                 | `minimal`, `low`, `medium`, `high`, `xhigh`                    | -         |
| `permissionMode` | `auto` (default), `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan`, `manual` | `read-only`, `workspace-write` (default), `danger-full-access` | -         |
| `maxBudgetUsd`   | optional                                                                          | -                                                              | -         |
| `command`        | -                                                                                 | -                                                              | required  |

- `claude` runs `claude -p`. Anything that needs approval is denied.
- `codex` runs `codex exec`. `permissionMode` sets its sandbox.
- `command` runs any other CLI, for example `command: gemini --yolo`. It gets the prompt on stdin, and its output is the result.

A setting the agent does not support fails validation.

## Scheduling

- If the Mac was asleep, each routine runs once for its latest missed time, up to 7 days back.
- A routine never runs twice at the same time. If it is still running at its next time, that run is skipped.
- At most 3 routines run at once.

## Updating

The daemon runs `git pull` every 5 minutes, so merged changes go live on their own. It only pulls when the checkout is on `main` with no local changes. Code changes restart the daemon, UI changes rebuild the dashboard, and running routines are not interrupted.

## Configuration

| Variable                  | Default               | What                                   |
| ------------------------- | --------------------- | -------------------------------------- |
| `KOMBINAT_PORT`           | `7433`                | dashboard port                         |
| `KOMBINAT_STATE_DIR`      | `~/.kombinat`         | logs and history                       |
| `KOMBINAT_ROUTINES_DIR`   | `./routines`          | routine files                          |
| `KOMBINAT_MAX_CONCURRENT` | `3`                   | routines that can run at once          |
| `KOMBINAT_TICK_SECONDS`   | `30`                  | how often the daemon checks routines   |
| `KOMBINAT_PULL_MINUTES`   | `5`                   | auto `git pull` interval, 0 to disable |
| `KOMBINAT_PULL_BRANCH`    | `main`                | branch the daemon pulls                |
| `CLAUDE_BIN`              | `~/.local/bin/claude` | Claude Code binary                     |
| `CODEX_BIN`               | `codex`               | Codex binary                           |

Set them before `pnpm cli install`. They are saved in the launchd config.

To try it on a laptop, put them in `.env.local` (see `.env.local.example`) and use the `:local` scripts, for example `pnpm cli:local list`.

## Development

```bash
pnpm dev        # run the daemon and the dashboard from this checkout
pnpm validate   # format, lint, typecheck and tests
```

`pnpm dev` pauses the launchd daemon until you press Ctrl-C. Add `--no-scheduler` to stop routines from running while you work.
