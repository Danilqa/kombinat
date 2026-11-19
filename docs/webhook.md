# Webhooks

With `webhook: true`, a POST request also starts the routine, and its body is added to the end of the prompt:

```bash
curl -X POST http://localhost:7433/api/routines/review-pr/webhook -d '{"pullRequest": 42}'
```

| Status | When                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------- |
| `200`  | The run started or is queued: `{"ok":true,"runId":"…"}`, or the gate ignored the request: `"runId":null` |
| `401`  | The gate rejected the request                                                                            |
| `404`  | The routine has no `webhook: true`                                                                       |
| `409`  | The routine is disabled                                                                                  |
| `413`  | The body is over 256 KB                                                                                  |
| `429`  | 100 requests already wait in the queue                                                                   |
| `504`  | The gate took longer than 3 seconds                                                                      |

While the routine runs, new requests wait in a queue and start one by one, oldest first, at the daemon's 30-second check. The agent gets only the body, not the headers or the query string.

## Call log

The Webhooks tab of the routine, in the dashboard and in the terminal dashboard, lists its latest calls, newest first: when each came, the status of the answer, what it did, such as the run it started or why the gate rejected it, and the start of its body. The daemon keeps the last 100 calls of each routine, with their whole body, in `webhooks/<routine>/` of its state folder, and deletes the older ones with the runs when the settings menu of the Runs page keeps runs for a limited time. Requests to a routine without `webhook: true` and bodies over 256 KB are not logged.

## Gate

`webhookGate` is an optional shell command that decides about each request first, for example to check the sender's signature or to skip events. It runs in the folder with `routines/`, gets the body on stdin and the headers as JSON in `KOMBINAT_WEBHOOK_HEADERS`, and has 3 seconds.

| Exit code | Result                                                                  |
| --------- | ----------------------------------------------------------------------- |
| `0`       | The run starts. What the command prints, if anything, replaces the body |
| `78`      | No run. The answer is `200`, with what the command prints if it is JSON |
| `79`      | The request belongs to a conversation, see [below](#conversations)      |
| Other     | No run. The answer is `401`                                             |

For example, to run only for new Linear issues:

```yaml
webhook: true
webhookGate: node scripts/check-linear.ts
```

```ts
// scripts/check-linear.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { buffer } from 'node:stream/consumers';

const body = await buffer(process.stdin);
const headers = JSON.parse(process.env.KOMBINAT_WEBHOOK_HEADERS ?? '{}');
const secret = process.env.KOMBINAT_LINEAR_SECRET ?? '';
const signature = createHmac('sha256', secret).update(body).digest();
const expected = Buffer.from(headers['linear-signature'] ?? '', 'hex');
if (!timingSafeEqual(signature, expected)) process.exit(1);
const event = JSON.parse(body.toString());
if (Math.abs(Date.now() - event.webhookTimestamp) > 60_000) process.exit(1);
if (event.type !== 'Issue' || event.action !== 'create') process.exit(78);
const { identifier, title, priority, labels, description } = event.data;
const issue = {
  identifier,
  title,
  url: event.url,
  priority,
  labels: labels?.map(label => label.name),
  description,
};
console.log(JSON.stringify(issue));
```

It rejects requests with a wrong signature or older than a minute, skips everything but new issues, and prints only the fields the agent needs. The prompt stays short, and the queue shows which issue each request is about.

Keep secrets in `KOMBINAT_` variables: they are the only ones that `install` saves for the daemon.

## Conversations

Some requests belong together, such as the messages of one Linear agent session or the comments on one pull request. A gate ties them to one run: it exits with `79` and prints a key for the conversation and the message for the agent as JSON:

```json
{ "conversation": "<key>", "message": "…" }
```

- The first message of a conversation starts a run, as a request body would, and the run keeps the key.
- A later message with the same key continues that run, as a message sent from its run page does: it goes into the run's chat, and the agent resumes its session, told that the message came from a webhook. The hooks do not run again.
- When that run has no session to continue, such as a run of the `command` agent or one that failed before its agent started, the message starts a new run, which takes over the key.
- While the routine runs, messages wait in the queue with the other webhooks and continue their run once the routine is free.
- `runId` in the answer is the run that the message continues or starts. A queued message gets the run it is expected to continue, which can miss when a run still at work ends without a session.

Keys belong to one routine, and the key is kept on its run, so once the run is deleted, the next message starts a new one. Output that is not such JSON answers `401`.

For example, to keep one run per Linear agent session, check the signature as above, then:

```ts
// scripts/check-linear-agent.ts
const event = JSON.parse(body.toString());
if (event.type !== 'AgentSessionEvent') process.exit(78);
const message = event.action === 'created' ? event.promptContext : event.agentActivity?.body;
if (!message) process.exit(78);
console.log(JSON.stringify({ conversation: event.agentSession.id, message }));
process.exit(79);
```

The session's first event starts a run with the issue's context, and each message written to the agent in that session continues it.
