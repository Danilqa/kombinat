---
name: umbrella-check
description: Says if you need an umbrella today
schedule: '0 8 * * 1-5'
cwd: ~/
agent: claude
model: claude-haiku-5-5
effort: low
timeoutMinutes: 5
---

Check today's weather forecast for where I am. wttr.in works without an API key.

Answer in one short line: do I need an umbrella today, and why.
