import { outputEventSchema } from './schemas';
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
        KOMBINAT_ROUTINE: routine.name,
        KOMBINAT_RUN_ID: runId,
        KOMBINAT_TRIGGER: trigger,
      },
      input: `${routine.prompt}\n`,
    };
  },

  readEvent(event, record) {
    const output = outputEventSchema.safeParse(event);
    if (!output.success) return {};
    const { text } = output.data;
    const resultText = record.resultText === null ? text : `${record.resultText}\n${text}`;
    return { resultText: resultText.slice(-MAX_RESULT_CHARS) };
  },

  buildTranscript(events) {
    const text = events
      .flatMap(event => {
        const output = outputEventSchema.safeParse(event);
        return output.success ? [output.data.text] : [];
      })
      .join('\n');
    return text.trim() ? [{ kind: 'text', key: 'output', text, isSubagent: false }] : [];
  },

  getResumeCommand: () => null,
};
