import { createKeyReader } from './keys';
import { toAnsi, type Line } from './text';
import { BASE } from './theme';

// Erasing paints with the current background, so the page colour is set first.
const PAGE = `\x1b[0;${BASE}m`;
// Alternate screen, hidden cursor, no line wrap, bracketed paste.
const ENTER = `\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[?2004h${PAGE}\x1b[2J`;
const LEAVE = '\x1b[0m\x1b[?2004l\x1b[?7h\x1b[?25h\x1b[?1049l';
// Synchronized output, so terminals that support it never show half a frame.
const BEGIN_FRAME = '\x1b[?2026h';
const END_FRAME = '\x1b[?2026l';

// Only rewrites the rows that changed since the last frame, which keeps it cheap over ssh.
export class Terminal {
  private previous: string[] = [];
  private isActive = false;

  get width(): number {
    return process.stdout.columns;
  }

  get height(): number {
    return process.stdout.rows;
  }

  start(onKeys: (keys: string[]) => void, onResize: () => void): void {
    this.isActive = true;
    process.stdout.write(ENTER);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    const readKeys = createKeyReader();
    process.stdin.on('data', (chunk: string) => {
      const keys = readKeys(chunk);
      if (keys.length > 0) onKeys(keys);
    });
    process.stdin.resume();
    process.stdout.on('resize', () => {
      this.previous = [];
      process.stdout.write(`${PAGE}\x1b[2J`);
      onResize();
    });
  }

  draw(frame: Line[]): void {
    if (!this.isActive) return;
    const rows = frame.map(line => toAnsi(line, BASE));
    let output = '';
    rows.forEach((row, index) => {
      // Clearing the row first means a cell the width math got wrong cannot linger.
      if (row !== this.previous[index]) output += `\x1b[${index + 1};1H${PAGE}\x1b[2K${row}`;
    });
    this.previous = rows;
    if (output) process.stdout.write(BEGIN_FRAME + output + END_FRAME);
  }

  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    process.stdout.write(LEAVE);
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}
