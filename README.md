<img src=".github/assets/banner.png" alt="Kombinat: routines in your repo, run by AI agents 24/7" width="100%" />

Background AI agents that run routines defined in your repository, 24/7. They run on your machine under launchd with Claude Code, Codex or any other CLI agent, using your normal subscription login.

Ready to use in your organisation or at home.

1. **Version-controlled by design.** Merge a `.md` file and the change is picked up automatically.
2. **Minimal and lightweight.** Run one command on a machine that is on 24/7. Easy for non-engineers to contribute to.
3. **Your own integrations.** Agents use your local environment as is, including skills, MCP, browser control and more.
4. **Cheap.** Works with your existing Claude or Codex subscription. Don't burn your money on tokens.
5. **Remote control.** Debug and monitor your remote machine from your mobile on your commute.
6. **Webhooks.** Linear, GitHub or any other app can start a routine with a request, and the agent gets its body.
7. **Battle-tested.** Polished on real use cases across engineering, design, product management and GTM.

**Ideas:**

1. **Post-release monitoring.** Checks Intercom, Sentry, Grafana and the logs for problems in code shipped over the last 3 days, raises an alert and opens PRs with fixes.
2. **On-call engineer.** Investigates production incidents and opens PRs to fix them.
3. **Flaky E2E test fixer.**
4. **Dead code and feature flag clean-up.**
5. **Picking up bug fixes.**
6. **Monitoring support chats for product signals.**
7. **Delegating tasks to an agent from your task manager.**

**Quickstart:**

1. Add Kombinat to the repository that will hold your routines.

   ```bash
   pnpm add @danilqa/kombinat        # with npm: npm install @danilqa/kombinat
   ```

2. Add your routines as `.md` files in a `routines/` folder next to `package.json`, see [Writing a routine](#writing-a-routine). Changes are picked up on the next check, no restart needed. Agents run with your usual setup, so your global skills, MCP servers and `CLAUDE.md` are picked up.

   ```
   my-routines-or-project/
   ├── routines/
   │   └── fix-e2e-tests.md
   └── package.json
   ```

3. Start from that folder.

   ```bash
   pnpm kombinat serve   # or: npx kombinat serve
   ```

   It runs in this terminal. To keep it running in the background and after reboots, stop it and run `pnpm kombinat install` instead, see [Setup](#setup).

4. Monitor and debug runs in the dashboard at http://localhost:7433, or in the terminal with `pnpm kombinat tui`, which also works over ssh. See [Monitoring](#monitoring). To open them from another machine, see [Remote access](#remote-access).

## Monitoring

<img src=".github/assets/dashboard.png" alt="Kombinat dashboard: routines list, week calendar and a run transcript" width="100%" />

The daemon serves a dashboard at http://localhost:7433.

- **Routines.**
- **Calendar.**
- **Runs.**
- **Daemon status.**

### In the terminal

<img src=".github/assets/tui.png" alt="Kombinat in the terminal: routines, recent runs and a routine's run history" width="100%" />

`pnpm kombinat tui` shows the same in the terminal. It works over ssh. Press `?` for keys.

## Remote access

### Over SSH

Turn on Remote Login on the Mac that runs Kombinat, in System Settings → General → Sharing. Then, on your laptop:

```bash
npx @danilqa/kombinat connect admin@mac-mini         # dashboard in the browser
npx @danilqa/kombinat connect admin@mac-mini --tui   # dashboard in the terminal
```

It opens an SSH tunnel to the daemon, then the dashboard. SSH asks for the password if you have no key set up. Ctrl-C disconnects. Instead of `admin@mac-mini`, use anything `ssh` accepts: a host from `~/.ssh/config`, an IP address or a Tailscale machine name. If the daemon there uses another `KOMBINAT_PORT`, add `--port`.

You can also ssh in and run `pnpm kombinat tui` in the folder Kombinat runs in.

### With Tailscale Serve

To open the dashboard from any device in your tailnet, your phone included, run this on the Mac that runs Kombinat:

```bash
tailscale serve --bg 7433
```

The dashboard is then at `https://mac-mini.<your-tailnet>.ts.net`, and `npx @danilqa/kombinat tui --url https://mac-mini.<your-tailnet>.ts.net` shows it in the terminal. Serve needs HTTPS certificates in your tailnet, the command asks to turn them on. They put the machine name in public certificate logs. It stays on after a reboot, `tailscale serve --https=443 off` turns it off. If the Mac has no `tailscale` command, see [Using the Tailscale CLI](https://tailscale.com/kb/1080/cli).

Everyone who can reach the Mac in your tailnet can then read transcripts and start routines. To limit that, allow only some people to reach port 443 of the Mac in your [Tailscale access rules](https://tailscale.com/kb/1018/acls).

## Routines

The example routines of this repository, one row per file in [`routines/`](routines/). Put the same `routines:start` and `routines:end` comments in your own README, and `pnpm kombinat readme` keeps a table like this one up to date.

<!-- prettier-ignore-start -->
<!-- routines:start -->
| Routine | When | What it does |
| - | - | - |
| [weather-example-routine](routines/weather-example-routine.md) | Weekdays at 08:00 | Says if you need an umbrella today |
| [weather-webhook-example-routine](routines/weather-webhook-example-routine.md) | On webhook | Says if you need an umbrella in the city from the request |
<!-- routines:end -->
<!-- prettier-ignore-end -->

## How it works

- Each routine is a markdown file. The frontmatter sets the schedule and settings, the body is the prompt.
- A small daemon checks every 30 seconds which routines are due and starts their agent. It also serves a dashboard at http://localhost:7433.
- launchd keeps the daemon running and starts it again after a reboot. Runs only happen while the Mac is awake and you are logged in.
- Logs and run history are stored in `~/.kombinat/`.
- Claude and Codex use your subscription login. API key variables are removed from their environment.

## Setup

You need Node 24 and the agents your routines use, logged in: Claude Code (`claude auth status`) and Codex (`codex login`). From the folder with `routines/` and `package.json`:

```bash
pnpm add @danilqa/kombinat
pnpm kombinat install
```

This starts the daemon under launchd, in that folder. Open http://localhost:7433. There is one daemon per macOS user, so running `install` in another folder moves it there.

## Commands

Run them from the same folder. With npm, use `npx kombinat` instead of `pnpm kombinat`, with Yarn `yarn kombinat`.

```bash
pnpm kombinat list           # routines, next run, last status
pnpm kombinat run <name>     # run a routine now, in the foreground
pnpm kombinat validate       # check all routine files
pnpm kombinat tui            # dashboard in the terminal, works over ssh
pnpm kombinat status         # daemon and scheduler state
pnpm kombinat readme         # update the routines table in README.md
pnpm kombinat uninstall      # stop and remove the daemon
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
- `webhook: true` lets other apps start the routine with a request, see [docs/webhook.md](docs/webhook.md).

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

## Webhooks

A routine with `webhook: true` also runs when another app, such as Linear or GitHub, sends it a request. The request body goes into the prompt, an optional `webhookGate` command checks and filters requests, and requests that arrive while the routine runs wait in a queue. See [docs/webhook.md](docs/webhook.md).

## Updating

The daemon runs `git pull` in the folder every 5 minutes, so merged changes go live on their own. It only pulls when the checkout is on `main` with no local changes.

To update Kombinat, bump `@danilqa/kombinat` in `package.json`, for example with a Renovate or Dependabot PR. When the lockfile changes, the daemon installs dependencies with pnpm, npm or Yarn and restarts. Running routines are not interrupted.

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

Set them before `pnpm kombinat install`. They are saved in the launchd config.
