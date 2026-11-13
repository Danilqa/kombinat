# Domains

A domain is the top path of an API request, or a type that several domains share:

- API paths: `/api/routines` is routine, `/api/runs` is run, `/api/calendar` is calendar and `/api/status` is daemon.
- Shared types: id, agent, transcript, scheduler (skips) and webhook (queued webhooks).

Each domain has up to two halves with the same name:

- `packages/domains/<domain>`, this package: what every app needs. The daemon, the TUI, the web app and e2e all import it.
- `packages/cli/src/domains/<domain>`: how the daemon does it, with files, child processes and config.

## Map

| Domain         | Shared half                                                                                                                                    | Daemon half                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **id**         | `RoutineName`, `RunId`, `CalendarEntryId` and `SessionId` with their branded schemas                                                           | none                                                                            |
| **agent**      | `AgentName`, agent label                                                                                                                       | claude, codex and command adapters, registry, settings validation, `AgentTask`  |
| **transcript** | item schemas and types, preview rule, subagent check, empty and result labels, `TranscriptList`                                                | none                                                                            |
| **run**        | `RunRecord`, status and trigger, requests, labels, id, duration, cursor pages, `makeRunRecord`, `RunStatusBadge`, `RunDetailList`, `RunOutput` | runner, record storage with orphan reconciliation, event log and transcript     |
| **scheduler**  | `Skip`, `SkipReason`, `SchedulerState`, skip label, `SkipsTable`                                                                               | tick loop, `scheduler.json` storage                                             |
| **routine**    | `RoutineSummary`, `RoutineDetail`, requests, `RunNowButton`, `RoutineBadges`, `RoutineDetailList`, `WebhookQueueButton`                        | frontmatter parsing, validation and defaults, loading, next run, schedule label |
| **calendar**   | entry schemas and types, `getCalendar`, `buildCalendar`, planned lengths, entry title and overlap labels, overlap count                        | none, `cli/src/server.ts` serves `buildCalendar`                                |
| **daemon**     | status schema, `getDaemonStatus`, health rules, `DaemonStatusIndicator`                                                                        | none, `cli/src/server.ts` builds the status                                     |
| **webhook**    | `QueuedWebhook`, webhook path, size and queue position labels, `WebhookQueueList`                                                              | gate, queue, and receiving: start, queue, ignore or reject                      |

Not domains:

- **cron** is a generic engine in `utils/cron.ts`. A schedule is a value of a routine.
- **launchd, init, self-update, connect and readme** are features of the cli, in `cli/src/features/`.
- **HTTP routing and read models** belong to the cli's `server.ts`.

## Definitions

### id

The identifiers that cross domains, as branded strings: `RoutineName` is a routine's name, which is its id, `RunId` a run's id, `CalendarEntryId` a calendar entry's id and `SessionId` an agent's session. A plain `string` does not pass for an id, and one id does not pass for another. A string becomes an id only through its schema's `parse`, where it comes in: a routine file, a state folder, a URL, a CLI argument, an agent's output or a test. The brand exists only in types, so the JSON stays the same.

The ids live in a domain of their own, below all the others, because a run record holds its routine's id and a queued webhook its run's id, while routine and run sit above them.

### agent

The CLI program that does a run's work:

- `claude`: Claude Code, `claude -p` with stream-json output;
- `codex`: `codex exec --json`;
- `command`: any shell command, run with `/bin/sh -c`, with plain-text output.

Every agent gets the prompt on stdin. An agent decides which routine settings it accepts and their defaults, how its process starts unattended, how its output becomes run updates and transcript items, and how its session is resumed: `claude --resume <id>`, `codex resume <id>`, none for command. Claude and Codex use the subscription login, so their API key variables are removed from the environment.

`AgentName` is shared by routine and run.

### transcript

An agent-independent view of a run's event log, ready to display: `{ eventCount, items }`. An item is one of:

- `hook`: the before hook, with its command, exit code and output;
- `init`: the session start;
- `text`: assistant text;
- `tool`: a tool call with its input, a preview, and a result that is `null` while the call is pending;
- `result`: the outcome.

The preview is the first line of the input, at most 160 characters. `isSubagent` marks items produced inside a subagent.

### run

One execution of a routine by its agent. The scheduler, Run now and webhooks start each run as a detached `kombinat run <name>` process, and `kombinat run <name>` in a terminal runs one in the foreground.

1. Preflight checks that the routine's `cwd` exists and that the agent binary is found.
2. The optional before hook runs with `/bin/sh -c` in `cwd`, with a 3-minute limit, `KOMBINAT_REPO` set to the project folder (the one with the `package.json`), and its `scripts/` first on `PATH`. A failure or a non-zero exit fails the run.
3. The agent is spawned. Only now is the record first written, as `running` with the agent's pid. Each stdout line is appended to the event log and can update the record.
4. A run that outlives `timeoutMinutes` gets SIGINT, then SIGTERM 60 s later, and ends as `timed_out`. Otherwise it ends as `succeeded` when the agent exits with 0 and reported no error, and as `failed` when it did not.

Invariants:

- A failed preflight or before hook writes a finished `failed` record at once. Until the agent is spawned there is no record, so the daemon remembers each run it starts and counts it as running until its record appears, for at most 4 minutes.
- A record still marked `running` whose process is gone becomes `aborted` the next time runs are listed.
- The id is a UTC timestamp plus 4 base-36 characters, such as `20261006T110000Z-k3x9`.
- The record is `<state dir>/runs/<routine>/<id>.json` and the event log `<id>.jsonl` next to it. This layout is a compatibility contract.
- A webhook run's request body waits in `<id>.payload` next to them until the run starts: the daemon writes it and starts the run with `--run-id <id>`, and the runner deletes it and adds the body to the end of the prompt in a code fence.
- The transcript is built from the event log: the before hook's line becomes a `hook` item, and the agent turns the other lines into items.
- `GET /api/runs` answers a page of runs, newest first by `startedAt`, then routine and id, with `nextCursor` and `total`. `routine` limits it to one routine and answers 404 when there is no such routine, a page holds 50 runs, and `cursor` is an opaque token for the run a page ends with, so the next page starts right after that run even when new runs arrive above it.

### scheduler

The daemon's decision of when routines start. Every `KOMBINAT_TICK_SECONDS` (default 30) it collects each scheduled routine's cron times that came due since the later of the last tick and the routine's last scheduled time, at most 7 days back, and keeps only the latest one.

- The run's trigger is `catch_up` when more than one time came due or the time is older than two ticks plus 60 s, and `schedule` otherwise.
- A disabled routine, or one that is already running, gets a skip.
- At the concurrency limit (`KOMBINAT_MAX_CONCURRENT`, default 3) the routine does not start and no skip is recorded.
- After the scheduled times, each enabled routine with `webhook: true` that is idle starts its oldest queued webhook, within the same limit.
- `scheduler.json` holds `lastTickAt` and, for each routine, its last scheduled time and its last 50 skips.

### routine

A named, version-controlled unit of recurring agent work: one markdown file, `routines/<name>.md`. Its frontmatter holds scalar values only and sets `name`, `description`, `schedule`, `cwd`, `agent` and its settings, `enabled`, `webhook` with an optional `webhookGate`, `timeoutMinutes` and an optional `before` hook. The body is the prompt.

- `name` equals the file name and is lowercase kebab-case.
- `schedule` is a 5-field cron in local time, or `manual`, which is stored as `null`.
- `cwd` is required, and a leading `~` is expanded.
- The prompt is not empty.
- `agent` defaults to `claude`, `enabled` to `true`, `webhook` to `false` and `timeoutMinutes` to 55. `webhook` must be `true` or `false`, and `webhookGate` needs `webhook: true`.
- The schedule gives the routine its next run, `null` when it is manual or disabled, and its label: `Manual` or the cron in words.

Clients see a routine as a summary (its definition plus next run, running, last run and last skip) or a detail (plus the prompt, skips and queued webhooks). Its runs come page by page from `/api/runs`. They can start it with Run now, which answers 409 while the routine is running.

A routine with `webhook: true` also starts from a [webhook](#webhook).

### webhook

A request from another app that starts a routine, `POST /api/routines/<name>/webhook`. The daemon half receives it in `receive.ts`, with the gate in `gate.ts` and the queue in `queue.ts`, and `cli/src/server.ts` only turns the outcome into an HTTP answer.

A routine with `webhook: true` accepts it. Its request body, at most 256 KB, becomes the run's payload, and the answer is 200 with the run's id. Without the flag it answers 404, and 409 when the routine is disabled. Each such run has the trigger `webhook`.

While the routine runs or has webhooks waiting, an accepted request is queued instead, as `<state dir>/queue/<routine>/<time>-<run id>.payload`, and still answers 200 with the id its run will get. The time is in milliseconds and strictly increasing, so the file names sort oldest first. A routine holds at most 100 queued webhooks, after which the answer is 429. The scheduler starts them, so they wait while it is off.

The routine's `webhookGate`, a shell command, decides about each request first. It runs in the project folder with the `before` hook's `KOMBINAT_REPO` and `PATH`, gets the raw body on stdin and the headers as JSON in `KOMBINAT_WEBHOOK_HEADERS`, and is killed after 3 s, which answers 504. Exit 0 starts the run, and a non-blank output replaces the payload. Exit 78 starts nothing and answers 200, with the output as the body when it is JSON and `{"ok":true,"runId":null}` otherwise, so senders such as Linear do not retry. Any other exit answers 401 and logs the gate's stderr in the daemon log. The gate runs before the disabled check and the queue, so an ignored event never gets a 409 or waits.

### calendar

The week view's read model, `GET /api/calendar?from&to` for a range of at most 32 days.

- Run blocks are the runs that overlap the range. A block is at least 10 minutes long, and a running run extends to now.
- Planned blocks are the future cron times of enabled, scheduled routines, from the later of `from` and now.
- A planned block is as long as the median of the routine's 5 newest finished, non-aborted runs, rounded up, at most the timeout and at least 10 minutes, and marked estimated. Without such runs it is 20 minutes, or the timeout when that is shorter.
- Blocks of different routines that overlap list each other's ids.

### daemon

The running kombinat service as its clients see it through `GET /api/status`: version, pid, start time, last scheduler tick, routines and state folders, agent binaries, concurrency limit, running count, time zone and now.

Its health is `unreachable` when the request fails, `stale` when there has been no tick or the last tick is more than 5 minutes old, and `healthy` otherwise.

## Dependency orders

A domain imports only the domains on the levels before its own, never one on its own level. There is one order of levels per half:

- Shared: `id`, then `agent`, `transcript`, `scheduler`, `daemon` and `webhook`, then `run`, then `routine` and `calendar`. Every domain types its ids with the id domain, a run record holds its agent's name, a run's transcript request returns a transcript, a routine summary embeds its last run and last skip and a detail its queued webhooks, and calendar entries carry run statuses and triggers.
- Daemon: `agent`, then `routine`, then `run`, then `webhook`, then `scheduler`. A routine validates its agent's settings, a run starts a routine's agent, a webhook starts or queues a run, and the scheduler loads routines and starts runs and queued webhooks.

The orders differ, because routine is below run in the daemon but above it in the shared half. Each half is acyclic on its own, and any daemon domain may import any shared domain. ESLint enforces both orders on static imports, tests included: the agent adapter tests build their task with `makeAgentTask` instead of importing routine code. It does not see `await import()`, which tests use to load modules after they set the environment, so check those imports by hand.

## Files

A domain folder in this package can have:

- `types.ts`: the types inferred from the schemas and other domain types;
- `schemas.ts`: zod schemas of what kombinat stores or serves. The JSON on disk and over HTTP is a contract;
- `requests.ts`: API requests. Each takes an `HttpClient` from `utils/http` first: `sameOriginApi` in the browser, the TUI's client with its base URL and timeout;
- `constants.ts`: fixed values, such as `RUNS_PAGE_SIZE` and `STALE_TICK_MS`;
- `utils.ts`: pure rules and labels;
- `mocks.ts`: test data, imported only from `*.test.ts`, `*.e2e.ts` and `packages/e2e`;
- `*.test.ts`: unit tests next to the rules they cover, run by `pnpm test`;
- `components/`: router-free React components, exported through `components/index.ts` as `domains/<domain>/components`. A component made of parts is exported as a namespace, as in design-system.

Components per domain: run `RunStatusBadge`, `RunDetailList` and `RunOutput`; transcript `TranscriptList`; daemon `DaemonStatusIndicator`; routine `RunNowButton`, `RoutineBadges` and `RoutineDetailList`; scheduler `SkipsTable`.

Other packages import everything else per file, such as `domains/run/schemas`. Inside this package, files import each other by relative path.

## Rules

- No routing, no `node:*` outside `*.test.ts`, no env and no cli config: the daemon, the TUI and the web app all run this code.
- Only `components/` imports React, React Query, lucide-react and `design-system`, because cli and tui import the rest.
- Labels that the web app and the TUI share live in `utils.ts`. Each renderer keeps its own icons and colours.
