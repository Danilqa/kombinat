---
name: weather-webhook-example-routine
description: Says if you need an umbrella in the city from the request
schedule: manual
webhook: true
webhookGate: node scripts/check-weather-request.ts
cwd: ~/
agent: claude
model: claude-haiku-5-5
effort: low
timeoutMinutes: 5
---

The request body is a place with its coordinates, which `webhookGate` found from a request like `{"city": "Berlin"}`. Check today's weather forecast there. wttr.in works without an API key.

Answer in one short line: do I need an umbrella there today, and why.
