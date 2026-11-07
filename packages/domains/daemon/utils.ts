import { STALE_TICK_MS } from './constants';
import type { DaemonHealth, DaemonStatus } from './types';

export function getIsTickStale(status: DaemonStatus): boolean {
  if (status.lastTickAt === null) return true;
  return new Date(status.now).getTime() - new Date(status.lastTickAt).getTime() > STALE_TICK_MS;
}

export function getDaemonHealth(status: DaemonStatus | null, hasError: boolean): DaemonHealth {
  if (hasError || status === null) return 'unreachable';
  return getIsTickStale(status) ? 'stale' : 'healthy';
}
