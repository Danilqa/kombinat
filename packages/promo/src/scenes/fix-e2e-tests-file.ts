import type { CodeToken } from '../components/code-line';

// routines/fix-e2e-tests.md, the routine the video and the thumbnail show.
export const FIX_E2E_TESTS_LINES: CodeToken[][] = [
  [{ text: '---', tone: 'faint' }],
  [
    { text: 'name: ', tone: 'key' },
    { text: 'fix-e2e-tests', tone: 'value' },
  ],
  [
    { text: 'description: ', tone: 'key' },
    { text: 'Finds the failing e2e test and fixes it', tone: 'value' },
  ],
  [
    { text: 'schedule: ', tone: 'key' },
    { text: "'30 11 * * *'", tone: 'string' },
    { text: '  # daily at 11:30', tone: 'comment' },
  ],
  [
    { text: 'agent: ', tone: 'key' },
    { text: 'claude', tone: 'value' },
  ],
  [
    { text: 'model: ', tone: 'key' },
    { text: 'claude-opus-5-5', tone: 'value' },
  ],
  [{ text: '---', tone: 'faint' }],
  [],
  [{ text: 'Open the latest failed e2e run on GitHub and find the failing test.', tone: 'prose' }],
  [{ text: 'Fix the test or the code, prove it with 10 runs in a row,', tone: 'prose' }],
  [{ text: 'then open a pull request.', tone: 'prose' }],
];
