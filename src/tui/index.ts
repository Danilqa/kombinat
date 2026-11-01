import { createDaemonClient } from './api';
import { TuiApp } from './app';
import { Terminal } from './terminal';

const POLL_ACTIVE_MS = 3000;
const POLL_IDLE_MS = 10_000;
// Spinners and live durations need a fast repaint only while something runs.
const FRAME_ACTIVE_MS = 150;
const FRAME_IDLE_MS = 1000;

export function runTui(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('tui needs an interactive terminal');
  const terminal = new Terminal();
  const draw = () => terminal.draw(app.render(terminal.width, terminal.height));
  const app = new TuiApp({ client: createDaemonClient(), onChange: draw });
  let pollTimer: NodeJS.Timeout | undefined;
  let frameTimer: NodeJS.Timeout | undefined;

  return new Promise(resolve => {
    const quit = () => {
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

    const poll = async () => {
      await app.refresh();
      pollTimer = setTimeout(
        () => void poll(),
        app.hasActiveRuns() ? POLL_ACTIVE_MS : POLL_IDLE_MS,
      );
    };
    const repaint = () => {
      draw();
      frameTimer = setTimeout(repaint, app.hasActiveRuns() ? FRAME_ACTIVE_MS : FRAME_IDLE_MS);
    };

    terminal.start(keys => {
      if (app.handleKeys(keys, terminal.width, terminal.height) === 'quit') {
        quit();
        return;
      }
      draw();
    }, draw);
    void poll();
    repaint();
  });
}
