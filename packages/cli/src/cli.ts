import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';

import { isMatching, match } from 'ts-pattern';

import { runTriggerSchema } from 'domains/run/schemas';
import type { RunTrigger } from 'domains/run/types';
import { runTui } from 'tui';

import { config, DEFAULT_PORT } from './config';
import { getRoutine, loadRoutines } from './domains/routine/storage';
import { getNextRun } from './domains/routine/utils';
import { runRoutine } from './domains/run/runner';
import { ensureStateDirs, listRuns } from './domains/run/storage';
import { readSchedulerState } from './domains/scheduler/storage';
import { startSchedulerLoop } from './domains/scheduler/tick';
import { connect } from './features/connect/connect';
import {
  getDaemonFolder,
  getLaunchdStatus,
  install,
  isLaunchdLoaded,
  startLaunchd,
  stopLaunchd,
  uninstall,
} from './features/launchd/install';
import { updateReadme } from './features/readme/readme';
import {
  buildWebAppIfStale,
  installDepsIfStale,
  pullLatest,
  startAutoPull,
  startReloadWatchers,
} from './features/self-update/reload';
import { startServer } from './server';
import { describeCron } from './utils/cron';

const USAGE = `kombinat, run from the folder that holds routines/ (connect and tui --url work anywhere)

  tui [--url <url>]         keyboard dashboard in the terminal (works over ssh), talks to the
                            running daemon, or to the one at --url
  connect <destination>     dashboard of a daemon on another machine through an ssh tunnel, in the
                            browser or with --tui in the terminal; --port is the daemon port
                            there (default ${DEFAULT_PORT}), for example connect admin@mac-mini --tui
  list                      show routines from ./routines with next run and last status
  validate                  parse every routine file and report errors
  readme                    regenerate the routines table in README.md
  run <name>                run one routine now in the foreground (what the scheduler spawns)
  serve                     run scheduler + web UI (what launchd runs); pulls the main branch
                            every 5 min, installs deps and restarts when the lockfile changes;
                            in a checkout of kombinat also builds the UI and restarts when src/
                            changes
  pull                      git pull once, the way serve does it (ff-only, clean tree)
  dev                       take over from launchd: scheduler + API from this checkout with no
                            auto-restart, plus the Vite dev server; Ctrl-C hands back to launchd
  install                   write the LaunchAgent plist and start the daemon
  uninstall                 stop the daemon and remove the plist
  status                    daemon and scheduler state
`;

interface CliOptions {
  trigger: RunTrigger;
  scheduledFor: string | null;
  watch: boolean;
  scheduler: boolean;
  url: string | null;
  remotePort: number;
  tui: boolean;
}

function log(line: string): void {
  console.log(`${new Date().toISOString()} ${line}`);
}

function formatTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '-';
}

function parseTrigger(value: string): RunTrigger {
  const parsed = runTriggerSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`--trigger must be one of ${runTriggerSchema.options.join(', ')}`);
  }
  return parsed.data;
}

function parseUrl(value: string): string {
  const url = URL.parse(value);
  if (url === null || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('--url must be an http(s) URL, for example https://mac-mini.example.ts.net');
  }
  return value.replace(/\/+$/, '');
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('--port must be a port number');
  }
  return port;
}

function checkFlag(isSet: boolean, flag: string, command: string | undefined, owner: string): void {
  if (isSet && command !== owner) throw new Error(`--${flag} only works with ${owner}`);
}

function startScheduler(options: CliOptions): () => void {
  return options.scheduler ? startSchedulerLoop(log) : () => undefined;
}

async function showTui(options: CliOptions): Promise<void> {
  await runTui(options.url ?? `http://127.0.0.1:${config.port}`);
  process.exit(0);
}

async function connectTo(destination: string | undefined, options: CliOptions): Promise<void> {
  if (destination === undefined) {
    throw new Error('connect needs an ssh destination, for example admin@mac-mini');
  }
  process.exit(await connect({ destination, remotePort: options.remotePort, tui: options.tui }));
}

function listRoutines(): void {
  for (const routine of loadRoutines()) {
    const last = listRuns(routine.name)[0];
    const when = routine.schedule === null ? 'manual' : describeCron(routine.schedule);
    console.log(
      [
        `${routine.enabled ? '●' : '○'} ${routine.name.padEnd(28)}`,
        routine.agent.padEnd(8),
        when.padEnd(32),
        `next ${formatTime(getNextRun(routine)).padEnd(22)}`,
        `last ${last ? `${last.status} ${formatTime(last.startedAt)}` : '-'}`,
      ].join(' '),
    );
  }
}

async function runOne(name: string | undefined, options: CliOptions): Promise<void> {
  if (name === undefined) throw new Error('run needs a routine name');
  ensureStateDirs();
  const record = await runRoutine(getRoutine(name), {
    trigger: options.trigger,
    scheduledFor: options.scheduledFor,
  });
  console.log(JSON.stringify(record, null, 2));
  process.exitCode = isMatching({ status: 'succeeded' }, record) ? 0 : 1;
}

function serve(options: CliOptions): void {
  ensureStateDirs();
  const managed = config.managed ? ', managed by launchd' : '';
  log(
    `kombinat serve pid ${process.pid}, routines ${config.routinesDir}, state ${config.stateDir}${managed}`,
  );
  installDepsIfStale(log);
  buildWebAppIfStale(log);
  const stopScheduler = startScheduler(options);
  const server = startServer(log);
  const shutdown = (): void => {
    stopScheduler();
    server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  if (!options.watch) return;
  if (config.managed) startAutoPull(log);
  startReloadWatchers(log, reason => {
    if (!config.managed) {
      log(`${reason}, restart serve to pick it up`);
      return;
    }
    log(`${reason}, exiting so launchd restarts with the new code`);
    shutdown();
  });
}

function pull(): void {
  const result = pullLatest();
  console.log(`${result.status}: ${result.detail}`);
  process.exitCode = isMatching({ status: 'failed' }, result) ? 1 : 0;
}

function dev(options: CliOptions): void {
  const { workspaceRoot } = config;
  if (workspaceRoot === null)
    throw new Error('dev only works in a checkout of the kombinat repository');
  ensureStateDirs();
  const hadLaunchd = isLaunchdLoaded();
  if (hadLaunchd) {
    stopLaunchd();
    log('stopped the launchd daemon, this process takes over until Ctrl-C');
  }
  // Ticking here would make the daemon skip the missed runs of its own routines.
  const daemonFolder = hadLaunchd ? getDaemonFolder() : null;
  const isOtherFolder = daemonFolder !== null && daemonFolder !== config.projectRoot;
  if (isOtherFolder) log(`the daemon runs ${daemonFolder}, so the scheduler stays off here`);
  const stopScheduler = startScheduler({
    ...options,
    scheduler: options.scheduler && !isOtherFolder,
  });
  const server = startServer(log);
  const vite = spawn('pnpm', ['-s', '--filter', 'web-app', 'run', 'dev'], {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });
  let closing = false;
  const handBack = (): void => {
    if (closing) return;
    closing = true;
    vite.kill('SIGTERM');
    stopScheduler();
    server.close();
    if (hadLaunchd) {
      startLaunchd();
      log('launchd daemon started again');
    }
    process.exit(0);
  };
  process.on('SIGINT', handBack);
  process.on('SIGTERM', handBack);
  vite.on('exit', handBack);
}

function showStatus(): void {
  const launchd = getLaunchdStatus()
    .split('\n')
    .filter(line => /state|pid|last exit|runs/.test(line))
    .join('\n');
  console.log(launchd || 'not loaded');
  console.log(JSON.stringify(readSchedulerState(), null, 2));
}

function showUsage(command: string | undefined): void {
  console.log(USAGE);
  process.exitCode = command === undefined ? 0 : 1;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      trigger: { type: 'string', default: 'manual' },
      'scheduled-for': { type: 'string' },
      'no-watch': { type: 'boolean', default: false },
      'no-scheduler': { type: 'boolean', default: false },
      url: { type: 'string' },
      port: { type: 'string' },
      tui: { type: 'boolean', default: false },
    },
  });
  const [command, name] = positionals;
  checkFlag(values.url !== undefined, 'url', command, 'tui');
  checkFlag(values.port !== undefined, 'port', command, 'connect');
  checkFlag(values.tui, 'tui', command, 'connect');
  const options: CliOptions = {
    trigger: parseTrigger(values.trigger),
    scheduledFor: values['scheduled-for'] ?? null,
    watch: !values['no-watch'],
    scheduler: !values['no-scheduler'],
    url: values.url === undefined ? null : parseUrl(values.url),
    remotePort: parsePort(values.port ?? String(DEFAULT_PORT)),
    tui: values.tui,
  };

  await match(command)
    .with('tui', () => showTui(options))
    .with('connect', () => connectTo(name, options))
    .with('list', listRoutines)
    .with('validate', () => console.log(`${loadRoutines().length} routine(s) ok`))
    .with('readme', () =>
      console.log(updateReadme() ? 'README.md updated' : 'README.md already up to date'),
    )
    .with('run', () => runOne(name, options))
    .with('serve', () => serve(options))
    .with('pull', pull)
    .with('dev', () => dev(options))
    .with('install', () =>
      console.log(`installed ${install()}\nui: http://localhost:${config.port}`),
    )
    .with('uninstall', () => console.log(`removed ${uninstall()}`))
    .with('status', showStatus)
    .otherwise(showUsage);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
