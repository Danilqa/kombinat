import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const CLI = path.join(import.meta.dirname, '..', '..', '..', 'cli', 'bin', 'kombinat.js');

export interface Daemon {
  root: string;
  url: string;
  stop: () => Promise<void>;
}

async function getFreePort(): Promise<number> {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  server.close();
  if (address === null || typeof address === 'string') throw new Error('No free port found');
  return address.port;
}

function waitUntilListening(daemon: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    const read = (chunk: Buffer) => {
      output += String(chunk);
      if (output.includes('ui at ')) resolve();
    };
    daemon.stdout?.on('data', read);
    daemon.stderr?.on('data', read);
    daemon.once('exit', code =>
      reject(new Error(`kombinat serve exited with ${code}:\n${output}`)),
    );
  });
}

function getEnvWithoutKombinat(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('KOMBINAT_')),
  );
}

async function stopProcess(daemon: ChildProcess): Promise<void> {
  if (daemon.exitCode !== null || daemon.signalCode !== null) return;
  daemon.kill();
  await once(daemon, 'exit');
}

export async function startDaemon(): Promise<Daemon> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-e2e-')));
  const port = await getFreePort();
  const daemon = spawn(process.execPath, [CLI, 'serve', '--no-scheduler', '--no-watch'], {
    cwd: root,
    env: {
      ...getEnvWithoutKombinat(),
      KOMBINAT_ROUTINES_DIR: path.join(root, 'routines'),
      KOMBINAT_STATE_DIR: path.join(root, 'state'),
      KOMBINAT_PORT: String(port),
      TZ: 'UTC',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitUntilListening(daemon);
  return {
    root,
    url: `http://127.0.0.1:${port}`,
    stop: async () => {
      await stopProcess(daemon);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
