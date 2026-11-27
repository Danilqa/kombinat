---
name: review-routines
description: Reviews the routines of a Kombinat folder for wasted tokens, risky permissions, weak prompts and schedules that collide. Use when asked to review, audit or improve routines, or to cut what they cost.
---

# Review routines

Read every file in `routines/`, check it against the lists below and report what to change. Change nothing until asked.

Start with the facts. Run `kombinat` from the folder with `routines/`, with its package manager.

- `kombinat validate` reports wrong and misspelled settings.
- `kombinat list` shows how the last run of each routine ended.
- `curl -s http://localhost:7433/api/routines` gives each routine's `tokenUsage` of the last 7 days, with its share of all routines. Start with the ones that use the most.
- `curl -s 'http://localhost:7433/api/runs?routine=<name>'` gives a routine's last runs with their `resultText`.

## Cost

- Most of its scheduled runs answer "No…" or "Nothing…", and it has no `check` to skip them.
- The model is bigger than the job. Without `model`, Claude runs `claude-opus-5-5`. Lookups and short reports need only `claude-haiku-5-5` and `effort: low`.
- It runs more often than its work changes.
- A small job keeps the default `timeoutMinutes` of 55 and has no `maxBudgetTokens`.
- It has `memory: true` where a label or an open pull request could hold the state. Every run reads the notes.
- One long prompt does several jobs. Split it with `startsAfter`, and give each step the model it needs.

## Safety

- `permissionMode` is `bypassPermissions` or `danger-full-access`.
- It reads text from outside, such as issues, chats or webhook bodies, and the prompt doesn't call that text data, or its permissions are wider than the job.
- It has `webhook: true` and no `webhookGate`. Anyone who can reach the URL then starts a run with their own text.
- The prompt doesn't forbid what must not happen, such as merge, deploy, delete or close.
- It edits code without `worktree: true`, so it works in the checkout a person may use.
- A secret is written in the file. It belongs in a `KOMBINAT_` variable.

## Prompt

- The agent may have to ask a question. Nobody answers during a run.
- It doesn't say what to answer, or what to answer when there is nothing to do.
- It gives no way to check the work before the agent pushes or sends it.
- It names no commands to find the work, so each run looks for it in its own way.
- The `description` says how the routine works, not what it produces.

## Schedule and failures

- Several routines start at the same minute. At most 3 runs work at a time, and a routine that finds no free slot loses that time.
- A run takes longer than the time to the next one, so that time is skipped.
- `maxParallel` is above 1 without `worktree: true`, so the runs change the same checkout.
- A `check` exits 78 when its own command fails, so a broken check looks like nothing to do.
- A `before` that installs dependencies comes close to its 3 minutes.
- Its last runs are `failed` or `timed_out`, or the Inbox files them under Needs a look. Find out why with the `debug-runs` skill.

## Report

One line per finding, the most costly or risky first: the file, the problem and the change. Leave out what is fine. Then offer to make the changes, with the `write-routines` skill.
