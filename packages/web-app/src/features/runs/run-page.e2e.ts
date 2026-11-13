import { expect, test } from 'e2e/web-app';

test("shows a run's result, transcript and how to resume it", async ({
  page,
  kombinat,
  claude,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    sessionId: 'b5c1e2d4',
    resumeCommand: 'claude --resume b5c1e2d4',
    resultText: 'Fixed the **checkout** test.',
    events: [
      claude.init(),
      claude.text('The checkout test fails, running it alone.'),
      claude.toolUse('tool-1', 'Bash', { command: 'pnpm e2e checkout' }),
      claude.toolResult('tool-1', '1 passed'),
      claude.result(),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "${run.id}" [level=1]
    - text: Succeeded
    - term: Resume
    - definition: claude --resume b5c1e2d4
    - text: Result
    - paragraph:
      - text: Fixed the
      - strong: checkout
      - text: test.
  `);
  await expect(page.getByText('Session started')).toBeVisible();
  await expect(page.getByText('The checkout test fails, running it alone.')).toBeVisible();
  await page.getByRole('button', { name: 'Bash pnpm e2e checkout' }).click();
  await expect(page.getByRole('region', { name: 'Tool input' })).toContainText('pnpm e2e checkout');
  await expect(page.getByRole('region', { name: 'Tool result' })).toHaveText('1 passed');
  await expect(page.getByText('Finished', { exact: true })).toBeVisible();
});

test('shows why a run failed', async ({ page, kombinat, claude }) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    status: 'failed',
    exitCode: 1,
    error: 'Reached the budget of $2.00',
    events: [
      claude.toolUse('tool-1', 'Bash', { command: 'pnpm e2e' }),
      claude.toolResult('tool-1', 'Command timed out', true),
      claude.result(true),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "${run.id}" [level=1]
    - text: Failed
  `);
  await expect(page.getByRole('region', { name: 'Run error' })).toHaveText(
    'Reached the budget of $2.00',
  );
  await page.getByRole('button', { name: 'Bash pnpm e2e Failed' }).click();
  await expect(page.getByRole('region', { name: 'Tool error' })).toHaveText('Command timed out');
  await expect(page.getByText('Finished with error')).toBeVisible();
});

test('shows the before hook first and the after hook last', async ({ page, kombinat, claude }) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    events: [
      { type: 'before_hook', command: 'git pull', exitCode: 0, output: 'Already up to date.' },
      claude.init(),
      claude.result(),
      { type: 'after_hook', command: 'notify-slack', exitCode: 0, output: 'Posted to #routines' },
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  await expect(page.getByText(/^(Before hook|Finished|After hook)$/)).toHaveText([
    'Before hook',
    'Finished',
    'After hook',
  ]);
  await expect(page.getByRole('region', { name: 'Hook output' })).toHaveText([
    'Already up to date.',
    'Posted to #routines',
  ]);
});
