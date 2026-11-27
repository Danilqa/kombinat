---
name: migrate-to-routines
description: Moves scheduled jobs, such as crontab lines, scheduled GitHub Actions workflows, launchd jobs and systemd timers, to Kombinat routines. Use when asked to migrate, convert or replace a cron job or a scheduled workflow with a routine.
---

# Migrate to routines

## Steps

1. List the jobs: `crontab -l`, the workflows in `.github/workflows/` with `schedule`, and what else the user names.
2. For each job, say whether to move it. A job that runs an agent, or would do better with one, is worth moving. A plain script that works can stay where it is: it gains only the run history in the dashboard.
3. Write the routine with the `write-routines` skill, and map the job as below.
4. Run `kombinat validate`, then offer a test run with `kombinat run <name>`. It does the real work, so ask first.
5. Turn the old job off when the routine goes live, so the work never runs twice. Ask before you disable or delete a job.

## What changes

Tell the user what applies to the job:

- **The machine.** A routine runs on the user's machine, with its tools and logins, not on a clean runner. Check that what the job installs or signs in to is there. Comments and pull requests then come from the machine's account.
- **Time.** `schedule` is in the machine's local time. GitHub Actions cron is in UTC, so convert the hours. The routine then follows local time, summer time included.
- **Missed times.** A routine runs only while the machine is awake. After a sleep it runs once for the latest time it missed, up to 7 days back.
- **Overlap.** A scheduled time that comes while the routine still runs is skipped.

## Map the job

| The job has                                       | The routine gets                                                                                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A cron expression                                 | `schedule`, with 5 fields of numbers. Ranges, lists and steps work. Write `@daily` as `'0 0 * * *'` and `MON-FRI` as `1-5`. Sunday is 0 or 7. There is no `L`, `W`, `#` or `?`                                                         |
| Only `workflow_dispatch`, or no schedule          | `schedule: manual`. A routine with a schedule can be started by hand too                                                                                                                                                               |
| An event, such as `on: issues`                    | `webhook: true` with a gate, see the `write-webhook-gates` skill, and a webhook in the app's settings                                                                                                                                  |
| A prompt for an agent                             | The prompt. Add what a run without a person needs: what to answer, and what never to do                                                                                                                                                |
| Checkout and install steps                        | `cwd`. When the job edits code, also `worktree: true` and a `before` that installs the dependencies                                                                                                                                    |
| `timeout-minutes`                                 | `timeoutMinutes`. Without one, ask how long the job takes: the default stops a run after 55 minutes                                                                                                                                    |
| `needs`, or a workflow that follows another       | `startsAfter`, which takes one routine                                                                                                                                                                                                 |
| Secrets and variables                             | The machine's own logins, or `KOMBINAT_` variables, which `kombinat install` saves for the daemon                                                                                                                                      |
| A step that reports the outcome, such as to Slack | `after`, which gets the finished run as JSON on stdin                                                                                                                                                                                  |
| A script and no agent                             | `agent: command` with `command: <path to the script>`. It runs in a shell, so a redirect still works. The prompt can't be empty: write one line on what the script does. The script gets it on stdin, and what it prints is the result |
