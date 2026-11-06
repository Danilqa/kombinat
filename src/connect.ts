import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

import { match } from 'ts-pattern';

import { getErrorMessage } from './shared/errors';
import { runTui } from './tui';
import { createDaemonClient } from './tui/api';

export interface ConnectOptions {
  destination: string;
  remotePort: number;
  tui: boolean;
}

interface SshTunnel {
  // Resolves with the ssh exit code.
  closed: Promise<number>;
  isOpen(): boolean;
  // While quiet, only the last ssh message is kept, to explain a lost connection afterwards.
  setQuiet(quiet: boolean): void;
  getLastMessage(): string;
  close(): void;
}

const PROBE_INTERVAL_MS = 300;

export function buildSshArgs(destination: string, localPort: number, remotePort: number): string[] {
  return [
    '-N',
    '-o',
    'ExitOnForwardFailure=yes',
    // A shared connection would hold the tunnel in another ssh process that outlives this one.
    '-o',
    'ControlMaster=no',
    '-o',
    'ControlPath=none',
    // Ends ssh when the other machine stops answering, instead of keeping a dead tunnel open.
    '-o',
    'ServerAliveInterval=15',
    '-L',
    `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    '--',
    destination,
  ];
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function isListening(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

// ssh asks for passwords and host keys on the terminal itself, not on stdin, so it can still prompt.
function openTunnel(destination: string, localPort: number, remotePort: number): SshTunnel {
  const ssh = spawn('ssh', buildSshArgs(destination, localPort, remotePort), {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let isOpen = true;
  let isQuiet = false;
  let lastMessage = '';
  ssh.stderr.on('data', (chunk: Buffer) => {
    if (isQuiet) lastMessage = String(chunk).trim().split('\n').at(-1) ?? '';
    else process.stderr.write(chunk);
  });
  const closed = new Promise<number>(resolve => {
    ssh.on('error', error => {
      isOpen = false;
      console.error(`ssh failed to start: ${error.message}`);
      resolve(1);
    });
    ssh.on('exit', code => {
      isOpen = false;
      resolve(code ?? 1);
    });
  });
  process.on('exit', () => ssh.kill());
  return {
    closed,
    isOpen: () => isOpen,
    setQuiet: quiet => {
      isQuiet = quiet;
      lastMessage = '';
    },
    getLastMessage: () => lastMessage,
    close: () => ssh.kill(),
  };
}

async function waitUntilListening(tunnel: SshTunnel, port: number): Promise<boolean> {
  while (tunnel.isOpen()) {
    if (await isListening(port)) return true;
    await sleep(PROBE_INTERVAL_MS);
  }
  return false;
}

function openInBrowser(url: string): void {
  const opener = match(process.platform)
    .with('darwin', () => 'open')
    .with('win32', () => 'explorer.exe')
    .otherwise(() => 'xdg-open');
  spawn(opener, [url], { stdio: 'ignore', detached: true })
    .on('error', () => undefined)
    .unref();
}

// Disconnecting is Ctrl-C or quitting the TUI, so ssh ending on its own means the connection was lost.
async function reportLostConnection(tunnel: SshTunnel, destination: string): Promise<number> {
  const exitCode = await tunnel.closed;
  const message = tunnel.getLastMessage();
  if (message) console.error(message);
  console.error(`connection to ${destination} closed`);
  return exitCode === 0 ? 1 : exitCode;
}

export async function connect({ destination, remotePort, tui }: ConnectOptions): Promise<number> {
  const localPort = await getFreePort();
  const url = `http://127.0.0.1:${localPort}`;
  const tunnel = openTunnel(destination, localPort, remotePort);
  if (!(await waitUntilListening(tunnel, localPort))) return tunnel.closed;

  // A closed daemon port makes ssh print a line per request, the error below says it once.
  tunnel.setQuiet(true);
  const failure = await createDaemonClient(url)
    .getOverview()
    .then(
      () => null,
      (error: unknown) => error,
    );
  if (failure !== null) {
    tunnel.close();
    const reason = tunnel.getLastMessage() || getErrorMessage(failure);
    throw new Error(
      `no kombinat daemon answers on port ${remotePort} of ${destination}: ${reason}`,
      {
        cause: failure,
      },
    );
  }

  if (tui) {
    const lost = new AbortController();
    void tunnel.closed.then(() => {
      lost.abort();
    });
    await runTui(url, lost.signal);
    if (!tunnel.isOpen()) return reportLostConnection(tunnel, destination);
    tunnel.close();
    return 0;
  }

  // The exit handler of the tunnel closes ssh.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => process.exit(0));
  }
  tunnel.setQuiet(false);
  console.log(`connected to ${destination}, dashboard at ${url}, Ctrl-C to disconnect`);
  openInBrowser(url);
  return reportLostConnection(tunnel, destination);
}
