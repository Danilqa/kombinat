# How it works

## Routines

Each routine is a markdown file. The frontmatter at the top sets the schedule and settings. The rest of the file is the prompt.

## The daemon

- A small daemon checks every 30 seconds which routines are due and starts their agents.
- It also serves the dashboard at http://localhost:7433.
- launchd on macOS or systemd on Linux keeps the daemon running and starts it again after a reboot.
- Routines run only while the computer is awake and you are logged in. On Linux, [lingering](linux.md#lingering) lets them run while you are logged out.

## Run history

Logs and run history are stored in `~/.kombinat/`. Kombinat keeps runs forever by default.

To delete old runs and [webhook calls](webhook.md#call-log), open the settings menu of the Runs page, or press `s` in the terminal dashboard. You can delete those older than a week, a month or 3 months. The last run of each routine is always kept.

## Logins

Claude and Codex use your subscription login. Kombinat removes API key variables from their environment, so they don't switch to an API key.
