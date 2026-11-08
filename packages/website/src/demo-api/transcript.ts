import type { TranscriptItem } from 'domains/transcript/types';
import { toPreview } from 'domains/transcript/utils';

export type TranscriptStep = (key: string) => TranscriptItem;

interface InitOptions {
  model: string | null;
  cwd: string | null;
  toolCount: number | null;
  permissionMode: string | null;
}

export function init({ model, cwd, toolCount, permissionMode }: InitOptions): TranscriptStep {
  return key => ({ kind: 'init', key, model, cwd, toolCount, permissionMode });
}

export function hook(command: string, exitCode: number, output: string): TranscriptStep {
  return key => ({ kind: 'hook', key, command, exitCode, output });
}

export function text(value: string): TranscriptStep {
  return key => ({ kind: 'text', key, text: value, isSubagent: false });
}

// A null output is a call that was still pending when the run ended.
function tool(
  name: string,
  input: unknown,
  preview: string,
  output: string | null,
  isError = false,
): TranscriptStep {
  return key => ({
    kind: 'tool',
    key,
    id: `toolu_${key}`,
    name,
    input,
    preview: toPreview(preview),
    result: output === null ? null : { content: output, isError },
    isSubagent: false,
  });
}

export function bash(command: string, output: string | null, isError = false): TranscriptStep {
  return tool('Bash', { command }, command, output, isError);
}

export function read(filePath: string, output: string): TranscriptStep {
  return tool('Read', { file_path: filePath }, filePath, output);
}

export function edit(filePath: string, oldString: string, newString: string): TranscriptStep {
  return tool(
    'Edit',
    { file_path: filePath, old_string: oldString, new_string: newString },
    filePath,
    `The file ${filePath} has been updated.`,
  );
}

export function write(filePath: string, content: string): TranscriptStep {
  return tool(
    'Write',
    { file_path: filePath, content },
    filePath,
    `File created successfully at: ${filePath}`,
  );
}

export function webFetch(url: string, prompt: string, output: string): TranscriptStep {
  return tool('WebFetch', { url, prompt }, url, output);
}

export function mcp(name: string, input: unknown, output: string): TranscriptStep {
  return tool(name, input, JSON.stringify(input), output);
}

export function shell(command: string, output: string | null): TranscriptStep {
  return tool('Shell', { command }, command, output);
}

export function fileChange(paths: string[]): TranscriptStep {
  const changes = paths.map(path => ({ path, kind: 'update' }));
  return tool(
    'Edit',
    { changes },
    changes.map(change => `${change.kind} ${change.path}`).join(', '),
    'completed',
  );
}
