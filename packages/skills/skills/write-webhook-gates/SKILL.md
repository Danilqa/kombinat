---
name: write-webhook-gates
description: Writes the gate script of a Kombinat webhook routine. The gate checks the sender's signature, skips the events the routine doesn't need and keeps follow-up messages in one run. Use when connecting GitHub, Linear, Slack or another app to a routine with `webhook: true`, or when a webhook is rejected or starts runs it shouldn't.
---

# Write webhook gates

A routine with `webhook: true` starts on a POST to `http://localhost:7433/api/routines/<name>/webhook`, and the request body goes to the end of its prompt. Without a gate, anyone who can reach that URL starts a run with their own text. A gate is a command that decides about each request first:

```yaml
webhook: true
webhookGate: node scripts/check-github.ts
```

## How a gate runs

It runs in the folder with `routines/` and has 3 seconds. It gets the body on stdin, the headers as JSON in `KOMBINAT_WEBHOOK_HEADERS`, with their names in lowercase, and the routine's name in `KOMBINAT_ROUTINE`. It gets no URL and no query string.

| Exit  | Result                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------- |
| `0`   | The run starts. What the gate prints replaces the body. If it prints nothing, the body stays      |
| `78`  | No run. The sender gets `200`, with what the gate prints if it is JSON                            |
| `79`  | The request belongs to a conversation, see below                                                  |
| Other | No run. The sender gets `401`, and the routine's Webhooks tab shows what the gate wrote to stderr |

## Write the gate

1. Check the signature over the raw body, before you parse it. Exit 1 when it is wrong, and when the secret is not set.
2. When the app sends a time, reject a request that is too old.
3. Exit 78 for the events the routine doesn't need.
4. Print only the fields the agent needs, as JSON. The prompt stays short, and less text from outside reaches the agent.

```ts
// scripts/check-github.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { buffer } from 'node:stream/consumers';

const body = await buffer(process.stdin);
const headers = JSON.parse(process.env.KOMBINAT_WEBHOOK_HEADERS ?? '{}');
const secret = process.env.KOMBINAT_GITHUB_SECRET;
if (!secret) throw new Error('KOMBINAT_GITHUB_SECRET is not set');
const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
const signature = Buffer.from(headers['x-hub-signature-256'] ?? '');
if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) process.exit(1);
if (headers['x-github-event'] !== 'issues') process.exit(78);
const event = JSON.parse(body.toString());
if (event.action !== 'opened') process.exit(78);
const { number, title, html_url: url, body: description } = event.issue;
console.log(JSON.stringify({ number, title, url, description }));
```

Keep the secret in a `KOMBINAT_` variable. `kombinat install` saves only the ones set in the shell it runs in. To add one, have the user run it again with all of them set.

A signature proves the app, not the person. Where anyone can write, such as in a public repository, also check who did.

| App    | Signature                                                                                       | Also                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub | `x-hub-signature-256` is `sha256=` and the hex HMAC-SHA256 of the body                          | The event's name is in `x-github-event`. Set the webhook's content type to `application/json`                                                |
| Linear | `linear-signature` is the hex HMAC-SHA256 of the body                                           | Reject a `webhookTimestamp`, in the body and in milliseconds, older than a minute                                                            |
| Slack  | `x-slack-signature` is `v0=` and the hex HMAC-SHA256 of `v0:<x-slack-request-timestamp>:<body>` | Reject a timestamp, in seconds, older than 5 minutes. For a `url_verification` request, print `{"challenge": "<its challenge>"}` and exit 78 |

For another app, read how it signs requests in its own docs.

## Conversations

To keep follow-ups in one run, such as the comments on one pull request, exit 79 and print a key and the message for the agent:

```json
{ "conversation": "<key>", "message": "…" }
```

The key is any text, such as the number of the pull request, and belongs to this routine. The message is a string. The first message with a key starts a run, with the message at the end of the prompt. Each later one continues that run in its session, or starts a new run when the first one has no session, as with `agent: command`.

Other output with exit 79 answers `401`. In Node, set `process.exitCode = 79` after you print: `process.exit(79)` can cut long output.

## Reach the daemon

The daemon listens only on localhost, and its dashboard has no login. An app on the internet needs a public URL, from a tunnel or a reverse proxy. Forward only `/api/routines/<name>/webhook` to port 7433, never the whole dashboard.

## Test

Run the gate by hand before you connect the app, with a request you sign yourself:

```bash
body='{"action":"opened","issue":{"number":1,"title":"Crash","html_url":"https://example.com/1","body":"It crashes"}}'
signature="sha256=$(printf '%s' "$body" | openssl dgst -sha256 -hmac test | sed 's/^.* //')"
printf '%s' "$body" | KOMBINAT_GITHUB_SECRET=test KOMBINAT_WEBHOOK_HEADERS="{\"x-github-event\":\"issues\",\"x-hub-signature-256\":\"$signature\"}" node scripts/check-github.ts; echo "exit $?"
```

It must print the fields and exit 0. Change one character of the body, and it must exit 1. After a real request, the routine's Webhooks tab lists the call, the status of the answer and why the gate rejected it.
