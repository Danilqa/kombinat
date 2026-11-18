import { TuiApp } from './app';
import { createDaemonClient } from './daemon-client';
import { Terminal } from './terminal/terminal';

const POLL_ACTIVE_MS = 3000;
const POLL_IDLE_MS = 10_000;
// Spinners and live durations need a fast repaint only while something runs.
const FRAME_ACTIVE_MS = 150;
const FRAME_IDLE_MS = 1000;

export function runTui(baseUrl: string, stopSignal?: AbortSignal): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('tui needs an interactive terminal');
  const terminal = new Terminal();
  const draw = () => terminal.draw(app.render(terminal.width, terminal.height));
  const client = createDaemonClient(baseUrl);
  const app = new TuiApp({ client, onChange: draw });
  const watching = new AbortController();
  let pollTimer: NodeJS.Timeout | undefined;
  let frameTimer: NodeJS.Timeout | undefined;

  return new Promise(resolve => {
    const quit = () => {
      watching.abort();
      clearTimeout(pollTimer);
      clearTimeout(frameTimer);
      app.dispose();
      terminal.stop();
      resolve();
    };
    const crash = (err: unknown) => {
      terminal.stop();
      console.error(err);
      process.exit(1);
    };
    process.on('uncaughtException', crash);
    process.on('unhandledRejection', crash);
    for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT', 'SIGQUIT'] as const)
      process.on(signal, quit);
    stopSignal?.addEventListener('abort', quit);

    const schedulePoll = () => {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(
        () => void app.refresh().then(schedulePoll),
        app.checkHasActiveRuns() ? POLL_ACTIVE_MS : POLL_IDLE_MS,
      );
    };
    const repaint = () => {
      draw();
      frameTimer = setTimeout(repaint, app.checkHasActiveRuns() ? FRAME_ACTIVE_MS : FRAME_IDLE_MS);
    };

    terminal.start(keys => {
      if (app.handleKeys(keys, terminal.width, terminal.height) === 'quit') {
        quit();
        return;
      }
      draw();
    }, draw);
    void app.refresh().then(schedulePoll);
    void client.watchChanges(() => void app.reload().then(schedulePoll), watching.signal);
    repaint();
  });
}

export { createDaemonClient } from './daemon-client';
