// Events in the stream-json format Claude Code prints, which the daemon keeps as the run log.
export const claude = {
  init: () => ({
    type: 'system',
    subtype: 'init',
    model: 'claude-opus-5-5',
    cwd: '/repo',
    tools: ['Bash', 'Read', 'Edit'],
    permissionMode: 'auto',
  }),
  text: (text: string) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } }),
  toolUse: (id: string, name: string, input: unknown) => ({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name, input }] },
  }),
  toolResult: (id: string, content: string, isError = false) => ({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] },
  }),
  result: (isError = false) => ({
    type: 'result',
    is_error: isError,
    num_turns: 3,
    duration_ms: 95_000,
  }),
};
