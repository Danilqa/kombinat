import { STALE_TICK_MS } from './constants';
import type { DaemonHealth, DaemonStatus } from './types';

export function checkIsTickStale(status: DaemonStatus): boolean {
  if (status.lastTickAt === null) return true;
  return new Date(status.now).getTime() - new Date(status.lastTickAt).getTime() > STALE_TICK_MS;
}

export function getDaemonHealth(status: DaemonStatus | undefined, hasError: boolean): DaemonHealth {
  if (hasError || status === undefined) return 'unreachable';
  return checkIsTickStale(status) ? 'stale' : 'healthy';
}
