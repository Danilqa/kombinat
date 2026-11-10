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

## Gate

`webhookGate` is an optional shell command that decides about each request first, for example to check the sender's signature or to skip events. It runs in the folder with `routines/`, gets the body on stdin and the headers as JSON in `KOMBINAT_WEBHOOK_HEADERS`, and has 3 seconds.

| Exit code | Result                                                                  |
| --------- | ----------------------------------------------------------------------- |
| `0`       | The run starts. What the command prints, if anything, replaces the body |
| `78`      | No run. The answer is `200`, with what the command prints if it is JSON |
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
