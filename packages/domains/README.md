# Domains

A domain is the top path of an API request, or a type that several domains share:

- API paths: `/api/routines` is routine, `/api/runs` is run, `/api/calendar` is calendar, `/api/status` and `/api/events` are daemon, `/api/settings` is settings, `/api/releases` is release and `/api/inbox` is inbox.
- Shared types: agent, transcript, scheduler (skips) and webhook (queued webhooks and webhook calls).

Each domain has up to two halves with the same name:

- `packages/domains/<domain>`, this package: what every app needs. The daemon, the TUI, the web app and e2e all import it.
- `packages/cli/src/domains/<domain>`: how the daemon does it, with files, child processes and config.

## Map

| Domain         | Shared half                                                                                                                                                                                                             | Daemon half                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **agent**      | `AgentName`, `SessionId`, agent label                                                                                                                                                                                   | claude, codex and command adapters, registry, settings validation, `AgentTask`, plan usage storage  |
| **transcript** | item schemas and types, message source, preview rule, subagent check, tool input and search match, empty, result, hook and message source labels, `TranscriptList`                                                      | none                                                                                                |
| **run**        | `RunRecord`, `RunId`, status and trigger, requests, labels, new ids, duration, cursor pages, active and continue rules, expired runs, `makeRunRecord`, `RunStatusBadge`, `RunDetailList`, `RunOutput`, `RunMessageForm` | runner, replies, hooks, record storage with orphan reconciliation, event log, transcript, retention |
| **scheduler**  | `Skip`, `SkipReason`, `SchedulerState`, skip label, `SkipsTable`                                                                                                                                                        | tick loop, `scheduler.json` storage                                                                 |
| **routine**    | `RoutineName`, `RoutineSummary`, `RoutineDetail`, requests, `RunNowButton`, `RoutineBadges`, `RoutineDetailList`, `WebhookQueueButton`                                                                                  | file parsing, validation, defaults, loading, next run, schedule label, examples                     |
| **calendar**   | `CalendarEntryId`, entry schemas and types, `getCalendar`, `buildCalendar`, planned lengths, entry title and overlap labels, overlap count                                                                              | none, `cli/src/server.ts` serves `buildCalendar`                                                    |
| **daemon**     | status schema, `getDaemonStatus`, `watchDaemonChanges`, health rules, plan usage rules, `DaemonStatusIndicator`                                                                                                         | none, `cli/src/server.ts` builds the status                                                         |
| **webhook**    | `QueuedWebhook`, `WebhookCall`, `WebhookCallId`, webhook path, size, queue position and outcome labels, expired calls, `WebhookQueueList`                                                                               | gate, queue, conversations, call log, and receiving: start, continue, queue, ignore or reject       |
| **settings**   | `Settings`, defaults, retention options and labels, requests                                                                                                                                                            | `settings.json` storage                                                                             |
| **release**    | `ReleaseVersion`, `ReleaseUpdate`, requests, newer releases, the offered release, `UpdateCard`                                                                                                                          | none, `cli/src/features/self-update/releases.ts` checks GitHub and skips                            |
| **inbox**      | `InboxState`, requests, unread runs, marking runs read, groups and their labels, the summary line                                                                                                                       | `inbox.json` storage                                                                                |

Not domains:

- **cron** is a generic engine in `utils/cron.ts`. A schedule is a value of a routine.
- **connect, init, keep-awake, live-updates, machine-usage, readme, self-update and service** are features of the cli, in `cli/src/features/`. service picks launchd on macOS and systemd on Linux, and live-updates watches the routines and state folders for `/api/events`.
- **HTTP routing and read models** belong to the cli's `server.ts`.

## Definitions

### agent

The CLI program that does a run's work:

- `claude`: Claude Code, `claude -p` with stream-json output;
- `codex`: `codex exec --json`;
- `command`: any shell command, run with `/bin/sh -c`, with plain-text output.

Every agent gets the prompt on stdin. An agent decides which routine settings it accepts and their defaults, how its process starts unattended, how its output becomes run updates and transcript items, and how its session is resumed: `claude --resume <id>`, `codex resume <id>`, none for command. Claude and Codex use the subscription login, so their API key variables are removed from the environment.

`AgentName` is shared by routine and run.

### transcript

An agent-independent view of a run's event log, ready to display: `{ eventCount, items }`. An item is one of:

- `hook`: the before or the after hook, with its phase, command, exit code and output;
- `init`: the session start;
- `model-fallback`: the agent switched from one model to another, with the reason when it gave one;
- `text`: assistant text;
- `message`: a message sent to the run from the dashboard or a webhook, with its source, see [Continuing a run](#continuing-a-run);
- `tool`: a tool call with its input, a preview, and a result that is `null` while the call is pending;
- `result`: the outcome.

The preview is the first line of the input, at most 160 characters. `isSubagent` marks items produced inside a subagent.

### run

One execution of a routine by its agent. The scheduler, Run now and webhooks start each run as a detached `kombinat run <name>` process, and `kombinat run <name>` in a terminal runs one in the foreground.

1. Preflight checks that the routine's `cwd` exists and that the agent binary is found.
2. The optional before hook runs with `/bin/sh -c` in `cwd`, with a 3-minute limit after which it is killed with the processes it started, `KOMBINAT_REPO` set to the project folder (the one with the `package.json`), and its `scripts/` first on `PATH`. A failure, a non-zero exit or the limit fails the run.
3. The agent is spawned. Only now is the record first written, as `running` with the agent's pid. Each stdout line is appended to the event log and can update the record.
4. A run that outlives `timeoutMinutes` gets SIGINT, then SIGTERM 60 s later, and ends as `timed_out`. Otherwise it ends as `succeeded` when the agent exits with 0 and reported no error, and as `failed` when it did not.
5. The optional after hook runs once the outcome is known, whatever it is, a failed preflight or before hook included. It runs with `/bin/sh -c` in `cwd`, or in the project folder when `cwd` does not exist, with the before hook's 3-minute limit, `KOMBINAT_REPO` and `PATH`, plus `KOMBINAT_ROUTINE`, `KOMBINAT_RUN_ID`, `KOMBINAT_TRIGGER` and `KOMBINAT_RUN_STATUS`. It gets the finished record on stdin as one line of JSON. Its outcome is appended to the event log as an `after_hook` line and never changes the run.

Invariants:

- A failed preflight or before hook writes a finished `failed` record at once, or, with an after hook, a `running` record until the hook ends. Until the agent is spawned there is no record, so the daemon remembers each run it starts and counts it as running until its record appears, for at most 4 minutes.
- A record still marked `running` whose process is gone becomes `aborted` the next time runs are listed. An aborted run gets no after hook, because its runner is gone.
- With an after hook, the run stays `running` until the hook ends: the runner writes the record as `running` with its own pid, waits until the event log is written, runs the hook, appends its line and only then writes the finished record, the one the hook got. So the routine does not start again while its after hook runs, and the hook's line is in the log when a client sees the run end.
- The id is a UTC timestamp plus 4 base-36 characters, such as `20261006T110000Z-k3x9`.
- The record is `<state dir>/runs/<routine>/<id>.json` and the event log `<id>.jsonl` next to it. This layout is a compatibility contract.
- A webhook run's request body waits in `<id>.payload` next to them until the run starts: the daemon writes it and starts the run with `--run-id <id>`, and the runner deletes it and adds the body to the end of the prompt in a code fence.
- A run started for a webhook [conversation](#conversations) keeps its key in `conversation`, passed as `--conversation=<key>`. Other runs have `null`.
- The transcript is built from the event log: the hook lines become `hook` items, the before hook first and the after hook last, and the agent turns the other lines into items.
- With a run retention set, the daemon deletes the record and event log of each run that is not active and started longer ago than that, except the newest run of each routine. It does so when it starts, every hour and when the retention changes.
- `GET /api/runs` answers a page of runs, newest first by `startedAt`, then routine and id, with `nextCursor` and `total`. `routine` limits it to one routine and answers 404 when there is no such routine, a page holds 50 runs, and `cursor` is an opaque token for the run a page ends with, so the next page starts right after that run even when new runs arrive above it.

#### Continuing a run

A finished run whose agent resumes sessions, the one with a resume command, can be continued: `POST /api/runs/<routine>/<id>/messages` with `{ "text": "…" }`.

1. The daemon answers 400 for a blank text, 409 for a run without a resume command and 409 while the routine is running, then appends `{"type":"message","text":"…","source":"dashboard"}` to the event log. A webhook [conversation](#conversations) sends messages the same way, with `"source":"webhook"`, and waits in the queue instead of a 409.
2. It starts a detached `kombinat reply <routine> <id>` and writes the record with its pid as `replyPid`, so the run counts as replying from the start.
3. The reply resumes the session with the last message of the log in the routine's `cwd`, told whether it came from the dashboard or a webhook, with its settings and timeout but without its hooks: `claude -p --resume <id>` or `codex exec … resume <id> -`. Its lines go to the same event log. A failure the agent did not report itself is appended as `{"type":"reply_error","error":"…"}`.
4. It writes the record back with `replyPid` null, and the session id and resume command the reply reported. The status, times, result and cost stay those of the run.

Invariants:

- A run is active while it is `running` or has a `replyPid`. An active run keeps its routine running: the scheduler skips it, it counts against the concurrency limit, and Run now and webhooks wait.
- A `replyPid` whose process is gone becomes null the next time runs are listed, and a `reply_error` line says so.
- In the transcript, each message is followed by its reply's items, keyed under `reply-<n>`, after the run's after hook. A reply's session start is left out.
- A message logged without a source came from the dashboard, since only it sent messages before webhooks could.

### scheduler

The daemon's decision of when routines start. Every `KOMBINAT_TICK_SECONDS` (default 30) it collects each scheduled routine's cron times that came due since the later of the last tick and the routine's last scheduled time, at most 7 days back, and keeps only the latest one.

- The run's trigger is `catch_up` when more than one time came due or the time is older than two ticks plus 60 s, and `schedule` otherwise.
- A disabled routine, or one that is already running, gets a skip.
- At the concurrency limit (`KOMBINAT_MAX_CONCURRENT`, default 3) the routine does not start and no skip is recorded.
- After the scheduled times, each enabled routine with `webhook: true` that is idle starts its oldest queued webhook, within the same limit.
- `scheduler.json` holds `lastTickAt` and, for each routine, its last scheduled time and its last 50 skips.

### routine

A named, version-controlled unit of recurring agent work: one markdown file, `routines/<name>.md`. Its frontmatter holds scalar values only and sets `name`, `description`, `schedule`, `cwd`, `agent` and its settings, `enabled`, `webhook` with an optional `webhookGate`, `timeoutMinutes` and optional `before` and `after` hooks. The body is the prompt.

- `name` equals the file name and is lowercase kebab-case.
- `schedule` is a 5-field cron in local time, or `manual`, which is stored as `null`.
- `cwd` is required, and a leading `~` is expanded.
- The prompt is not empty.
- `agent` defaults to `claude`, `enabled` to `true`, `webhook` to `false` and `timeoutMinutes` to 55. `webhook` must be `true` or `false`, and `webhookGate` needs `webhook: true`.
- The schedule gives the routine its next run, `null` when it is manual or disabled, and its label: `Manual` or the cron in words.

Clients see a routine as a summary (its definition plus next run, running, last run and last skip) or a detail (plus the prompt, skips, queued webhooks and webhook calls). Its runs come page by page from `/api/runs`. They can start it with Run now, which answers 409 while the routine is running, and can give that run a changed prompt, which only that run gets.

A routine with `webhook: true` also starts from a [webhook](#webhook).

### webhook

A request from another app that starts a routine, `POST /api/routines/<name>/webhook`. The daemon half receives it in `receive.ts`, with the gate in `gate.ts` and the queue in `queue.ts`, and `cli/src/server.ts` only turns the outcome into an HTTP answer.

A routine with `webhook: true` accepts it. Its request body, at most 256 KB, becomes the run's payload, and the answer is 200 with the run's id. Without the flag it answers 404, and 409 when the routine is disabled. Each such run has the trigger `webhook`.

While the routine runs or has webhooks waiting, an accepted request is queued instead, as `<state dir>/queue/<routine>/<time>-<run id>.payload`, and still answers 200 with the id its run will get. The time is in milliseconds and strictly increasing, so the file names sort oldest first. A routine holds at most 100 queued webhooks, after which the answer is 429. The scheduler starts them, so they wait while it is off.

The routine's `webhookGate`, a shell command, decides about each request first. It runs in the project folder with the `before` hook's `KOMBINAT_REPO` and `PATH`, gets the raw body on stdin and the headers as JSON in `KOMBINAT_WEBHOOK_HEADERS`, and is killed after 3 s, which answers 504. Exit 0 starts the run, and a non-blank output replaces the payload. Exit 79 makes the request part of a conversation, see below. Exit 78 starts nothing and answers 200, with the output as the body when it is JSON and `{"ok":true,"runId":null}` otherwise, so senders such as Linear do not retry. Any other exit answers 401 and logs the gate's stderr in the daemon log. The gate runs before the disabled check and the queue, so an ignored event never gets a 409 or waits.

#### Conversations

A gate that exits with 79 prints `{"conversation":"<key>","message":"…"}`, with a key and a message that are not blank, or the request is rejected with 401. The key ties the requests of one conversation in the other app to one run of the routine, in `start.ts`:

1. The conversation's run is the newest run of the routine with that key in `conversation`, when it has a resume command.
2. With such a run, the message continues it as a dashboard message does, with `"source":"webhook"`. Without one, the message is the payload of a new webhook run that gets the key.
3. While the routine runs or has webhooks waiting, the request is queued like any other, with the key in a `<time>-<run id>.conversation` file next to its payload, and 1 and 2 happen when the scheduler takes it. The answer's `runId` is the newest run with the key when it is active or has a resume command, else the run that is starting with the key, else the run that an earlier queued request with the key will start, else the request's own. A run at work counts before it reports its session, so the answer can miss when that run ends without one.

#### Call log

Each request that reaches a routine with `webhook: true` is logged as a call in `<state dir>/webhooks/<routine>/<id>.json`, in `call-log.ts`: when it came, its outcome (`started`, `continued`, `queued`, `ignored`, `rejected`, `timed_out`, `disabled` or `queue_full`), the status of the answer, the run it started, continued or will start, the gate's reason for a rejection and the whole body. The id is the time it came in milliseconds, strictly increasing, so the file names sort oldest first.

- A routine keeps its newest 100 calls: logging a call deletes the older ones.
- The routine detail serves them newest first, each with the size of its body and its first 500 characters instead of the body.
- With a run retention set, the daemon deletes the calls that came longer ago than that, at the same times as it deletes runs. Unlike with runs, the newest call of a routine is not kept.

### settings

How the daemon itself behaves, set from the dashboards, `GET` and `PUT /api/settings`, and kept in `<state dir>/settings.json`. `runRetentionDays` is how long runs and [webhook calls](#call-log) are kept, `null` for forever, which is the default. The dashboards offer 1 week, 1 month, 3 months and forever.

### release

A published version of Kombinat, `GET /api/releases`: the installed version, the releases newer than it, newest first, with their notes from GitHub, the skipped version and the command that updates the project, such as `pnpm add --save-exact kombinat@0.6.0`.

Only a package installed from npm looks for releases, at most once an hour, and a failed check keeps the list of the last one. A checkout updates with `git pull`, so it reports none. Drafts, prereleases and tags that are not `x.y.z` are left out.

`POST /api/releases/<version>/skip` stores the version in `<state dir>/releases.json`. The newest release is offered until it is skipped, and a newer one is offered again.

### inbox

The runs that ended since the user last looked, `GET /api/inbox`, so that a failure or a finding is not missed among the quiet runs. `<state dir>/inbox.json` holds `since`, written the first time a client asks for the inbox or marks a run read, and the runs read since then.

- A run is unread when it is not active, ended after `since` and is not among the read runs. A run without an end time counts from its start.
- `POST /api/inbox/read` with `{ "runs": [{ "routine": "…", "id": "…" }] }` marks those runs read. It keeps only the keys of runs that still exist and ended after `since`, so the file shrinks as runs are deleted, and writes it only when it changes.
- The dashboard marks a run read when its page shows it finished, the TUI when it opens it, and Mark all as read sends the runs on screen, so a run that ends meanwhile stays unread.
- Unread runs are grouped: Needs a look for every status but succeeded, Nothing to report for a succeeded run whose result is empty or starts with the word "No" or "Nothing", and Has findings for the rest.

### calendar

The week view's read model, `GET /api/calendar?from&to` for a range of at most 32 days.

- Run blocks are the runs that overlap the range. A block is at least 10 minutes long, and a running run extends to now.
- Planned blocks are the future cron times of enabled, scheduled routines, from the later of `from` and now.
- A planned block is as long as the median of the routine's 5 newest finished, non-aborted runs, rounded up, at most the timeout and at least 10 minutes, and marked estimated. Without such runs it is 20 minutes, or the timeout when that is shorter.
- Blocks of different routines that overlap list each other's ids.

### daemon

The running kombinat service as its clients see it through `GET /api/status`: version, pid, start time, last scheduler tick, routines and state folders, agent binaries, concurrency limit, running count, time zone and now.

`claudeUsage` is how much of the Claude subscription the newest run used, or `null` before any run reported it:

- Claude Code's stream-json reports it in each `rate_limit_event` as the share used and the reset time of the 5-hour and the weekly limit. The runner writes the latest one to `<state dir>/plan-usage/claude.json` with the time it came, which the status serves.
- A limit whose reset time has passed is left out, because what was used since is unknown until the next run reports it. The dashboard and the TUI show the share left of the most used limit next to the running count.

`GET /api/events` is a stream of server-sent events with one `data: change` event, at most every 300 ms, after a routine file, a run record, the webhook queue, a webhook call, `inbox.json` or the skips and last scheduled times in `scheduler.json` change. Run logs and the tick time do not count: logs grow with every agent event, and clients poll the tick time with the status. A client refetches what it shows on each event and once after it reconnects. It reconnects 5 s after the stream breaks and stops when the answer is an error, such as from an older daemon or the website's demo. The dashboard follows the stream only while its tab is visible, since browsers allow 6 connections to a host across all tabs, and refetches when the tab shows again.

Its health is `unreachable` when the request fails, `stale` when there has been no tick or the last tick is more than 5 minutes old, and `healthy` otherwise.

## Dependency orders

A domain imports only the domains on the levels before its own, never one on its own level. There is one order of levels per half:

- Shared: `agent`, `transcript`, `scheduler`, `daemon`, `webhook`, `settings` and `release`, then `run`, then `routine`, `calendar` and `inbox`. A run record holds its agent's name, a run's transcript request returns a transcript, a routine summary embeds its last run and last skip and a detail its queued webhooks and webhook calls, calendar entries carry run statuses and triggers, and the inbox lists runs.
- Daemon: `agent`, `settings` and `inbox`, then `routine`, then `run`, then `webhook`, then `scheduler`. A routine validates its agent's settings, a run's retention comes from the settings, a run starts a routine's agent, a webhook starts or queues a run, and the scheduler loads routines and starts runs and queued webhooks.

The orders differ, because routine is below run in the daemon but above it in the shared half. Each half is acyclic on its own, and any daemon domain may import any shared domain. ESLint enforces both orders on static imports, tests included: the agent adapter tests build their task with `makeAgentTask` instead of importing routine code. It does not see `await import()`, which tests use to load modules after they set the environment, so check those imports by hand.

Besides its levels, a shared domain may import the `ids.ts` of any other, see [Ids](#ids).

## Ids

An id is a branded string: `RoutineName` is a routine's name, which is its id, `RunId` a run's id, `CalendarEntryId` a calendar entry's id, `WebhookCallId` a webhook call's id and `SessionId` an agent's session. A plain `string` does not pass for an id, and one id does not pass for another. A string becomes an id only through its schema's `parse`, where it comes in: a routine file, a state folder, a URL, a CLI argument, an agent's output or a test. The brand exists only in types, so the JSON stays the same.

Each id lives with its schema in the `ids.ts` of the domain it names: `routine/ids`, `run/ids`, `calendar/ids`, `webhook/ids` and `agent/ids`. Ids cross the levels: a run record holds its routine's name and a queued webhook its run's id, while routine sits above run and run above webhook. So `ids.ts` imports only zod, which keeps it a leaf that any domain can import without a cycle. In `routine/schemas.ts`, the routine name would make one: that file imports the run schemas, which need the routine name as they load.

## Files

A domain folder in this package can have:

- `types.ts`: the types inferred from the schemas and other domain types;
- `schemas.ts`: zod schemas of what kombinat stores or serves. The JSON on disk and over HTTP is a contract;
- `ids.ts`: the ids of the domain with their schemas, importing only zod, see [Ids](#ids);
- `requests.ts`: API requests. Each takes an `HttpClient` from `utils/http` first: `sameOriginApi` in the browser, the TUI's client with its base URL and timeout;
- `constants.ts`: fixed values, such as `RUNS_PAGE_SIZE` and `STALE_TICK_MS`;
- `utils.ts`: pure rules and labels;
- `mocks.ts`: test data, imported only from `*.test.ts`, `*.e2e.ts` and `packages/e2e`;
- `*.test.ts`: unit tests next to the rules they cover, run by `pnpm test`;
- `components/`: router-free React components, exported through `components/index.ts` as `domains/<domain>/components`. A component made of parts is exported as a namespace, as in design-system.

Components per domain: run `RunStatusBadge`, `RunDetailList`, `RunOutput` and `RunMessageForm`; transcript `TranscriptList`; daemon `DaemonStatusIndicator`; routine `RunNowButton`, `RoutineBadges` and `RoutineDetailList`; scheduler `SkipsTable`.

Other packages import everything else per file, such as `domains/run/schemas`. Inside this package, files import each other by relative path.

## Rules

- No routing, no `node:*` outside `*.test.ts`, no env and no cli config: the daemon, the TUI and the web app all run this code.
- Only `components/` imports React, React Query, lucide-react and `design-system`, because cli and tui import the rest.
- Labels that the web app and the TUI share live in `utils.ts`. Each renderer keeps its own icons and colours.
