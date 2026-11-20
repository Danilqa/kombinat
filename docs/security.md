# Security

## The dashboard

- The dashboard listens only on localhost and has no login. Other users of the same machine can open it.
- Anyone who opens it can start a routine with any prompt they write, or message the agent of a finished run. The agent then works in the routine's folder, with the routine's permissions.
- Web pages from other sites can't start runs or send messages through it.
- To open it from another machine, use SSH or Tailscale Serve, and limit who can reach it. See [Remote access](remote-access.md).

## Agent permissions

- Each routine sets its own permission mode, see [Agents](../README.md#agents).
- By default, Claude Code is denied anything that needs approval, and Codex writes only in its workspace.
- `bypassPermissions` and `danger-full-access` let the agent do anything your user can.

## Outside text

A routine that reads outside text, such as issues, support chats or a webhook body, can be steered by that text. To keep it safe:

- Give it the narrowest permissions.
- Let it open pull requests, but not merge them.
- Check webhook requests with a [`webhookGate`](webhook.md#gate).

## Updates from git

The daemon runs `git pull` every 5 minutes and installs dependencies when the lockfile changes. Whatever is merged into `main` runs on the machine, so protect `main` with review.

## Network

Kombinat has no telemetry. The daemon makes no network calls of its own. Only the tools it starts do: git, your package manager, the agents and your routines' commands. The dashboard loads its fonts from Google Fonts.

## Shared logins

Check the terms of your plan before your team shares one subscription login.
