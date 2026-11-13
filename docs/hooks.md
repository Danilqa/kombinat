# Hooks

A routine can run a shell command before its agent and another one after it:

```yaml
before: git pull --ff-only
after: notify-slack.mjs
```

Both run with `/bin/sh -c` and have 3 minutes. They get `KOMBINAT_REPO`, the folder with `routines/`, and its `scripts/` folder comes first on `PATH`, so a script there runs by its name.

## Before

`before` runs in the routine's `cwd` before the agent starts, for example to update a checkout or start a service. If it fails, exits with a non-zero code or takes more than 3 minutes, the agent does not start and the run fails.

## After

`after` runs once the run has ended, for example to send its result or its failure somewhere. It runs after every run that ends as `succeeded`, `failed` or `timed_out`. A failed run includes one that never started its agent: the `cwd` is missing, the agent binary is not found or `before` failed.

It does not run when the run is `aborted`, which means the runner itself stopped, for example when the Mac restarted. A schedule time that was skipped has no run, so nothing runs either.

It runs in the routine's `cwd`, or in the folder with `routines/` when `cwd` does not exist, with these variables:

| Variable              | Value                                         |
| --------------------- | --------------------------------------------- |
| `KOMBINAT_ROUTINE`    | The routine's name                            |
| `KOMBINAT_RUN_ID`     | The run's id                                  |
| `KOMBINAT_TRIGGER`    | `schedule`, `catch_up`, `manual` or `webhook` |
| `KOMBINAT_RUN_STATUS` | `succeeded`, `failed` or `timed_out`          |
| `KOMBINAT_REPO`       | The folder with `routines/`                   |

On stdin it gets the finished run as one line of JSON, the same object that `kombinat run` prints: `status`, `error`, `resultText`, `exitCode`, `costUsd`, `durationMs`, `startedAt`, `endedAt` and the rest.

The run counts as running until the hook ends, so the routine does not start again in the meantime. A hook that takes more than 3 minutes is killed. Its exit code and output never change the run's status. They show as the last item of the run's transcript, "After hook", in the dashboard and in the terminal.

## Post failures to Slack

Create an [incoming webhook](https://api.slack.com/messaging/webhooks) in Slack, then add this script to the project and make it executable with `chmod +x scripts/notify-slack.mjs`:

````js
#!/usr/bin/env node
// scripts/notify-slack.mjs
const status = process.env.KOMBINAT_RUN_STATUS;
const url = process.env.KOMBINAT_SLACK_WEBHOOK_URL;
if (status === 'succeeded') process.exit(0);
if (!url) throw new Error('KOMBINAT_SLACK_WEBHOOK_URL is not set');

let input = '';
for await (const chunk of process.stdin) input += chunk;
const run = JSON.parse(input);
const lines = [`*${run.routine}* ended as \`${status}\`, run ${run.id}`];
if (run.error) lines.push('```', run.error.slice(-1500), '```');

const response = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: lines.join('\n') }),
});
console.log(`Slack answered ${response.status}`);
if (!response.ok) process.exit(1);
````

Then call it from each routine that should report its failures:

```yaml
after: notify-slack.mjs
```

It stays quiet when the run succeeded, and otherwise posts the routine, the status, the run id and the error.

Keep the webhook URL in a `KOMBINAT_` variable, such as `KOMBINAT_SLACK_WEBHOOK_URL`: they are the only ones that `install` saves for the daemon.
