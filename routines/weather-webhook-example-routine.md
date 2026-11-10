---
name: weather-webhook-example-routine
description: Says if you need an umbrella in the city from the request
schedule: manual
webhook: true
cwd: ~/
agent: claude
model: claude-haiku-5-5
effort: low
timeoutMinutes: 5
---

The request body names a city, for example `{"city": "Berlin"}`. Check today's weather forecast there. wttr.in works without an API key.

Answer in one short line: do I need an umbrella there today, and why.
