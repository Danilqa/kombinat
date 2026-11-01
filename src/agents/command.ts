import { isOutputEvent } from '../transcript';
import { rejectUnsupported } from './settings';
import type { Agent } from './types';

const MAX_RESULT_CHARS = 20_000;

export const commandAgent: Agent = {
  name: 'command',
  output: 'text',
  binaryEnv: null,

  resolveSettings(raw) {
    rejectUnsupported(raw, ['model', 'effort', 'permissionMode', 'maxBudgetUsd'], 'command');
    if (raw.command === null) throw new Error('agent command needs a command');
    return raw;
  },

  buildInvocation({ routine, runId, trigger }) {
    return {
      command: '/bin/sh',
      args: ['-c', routine.command ?? ''],
      env: {
        ...process.env,
        PAPA_CARLO_ROUTINE: routine.name,
        PAPA_CARLO_RUN_ID: runId,
        PAPA_CARLO_TRIGGER: trigger,
      },
      input: `${routine.prompt}\n`,
    };
  },

  readEvent(event, record) {
    if (!isOutputEvent(event)) return {};
    const text = record.resultText === null ? event.text : `${record.resultText}\n${event.text}`;
    return { resultText: text.slice(-MAX_RESULT_CHARS) };
  },

  buildTranscript(events) {
    const text = events
      .filter(isOutputEvent)
      .map(event => event.text)
      .join('\n');
    return text.trim() ? [{ kind: 'text', key: 'output', text, isSubagent: false }] : [];
  },

  getResumeCommand: () => null,
};
