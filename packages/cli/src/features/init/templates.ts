import { routineNameSchema } from 'domains/id/schemas';
import type { RoutineName } from 'domains/id/types';

export interface RoutineTemplate {
  name: RoutineName;
  source: string;
}

export const HELLO_ROUTINE = routineNameSchema.parse('hello-example-routine');

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    name: HELLO_ROUTINE,
    source: `---
name: hello-example-routine
description: Says hello, to check that your setup works
schedule: manual
cwd: ~/
agent: claude
model: claude-haiku-5-5
effort: low
timeoutMinutes: 5
---

Say hello in one short line. You need no tools for this.
`,
  },
  {
    name: routineNameSchema.parse('weather-example-routine'),
    source: `---
name: weather-example-routine
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
`,
  },
  {
    name: routineNameSchema.parse('weather-webhook-example-routine'),
    source: `---
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

The request body names a city, for example \`{"city": "Berlin"}\`. Check today's weather forecast there. wttr.in works without an API key.

Answer in one short line: do I need an umbrella there today, and why.
`,
  },
];
