import { LOW_DISK_BYTES, LOW_USAGE_LEFT, STALE_TICK_MS } from './constants';
import type {
  CurrentUsageLimit,
  DaemonHealth,
  DaemonStatus,
  DiskSpace,
  PlanUsage,
  UsageLimit,
} from './types';

const BYTE_UNITS = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

const percentFormatter = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export function checkIsTickStale(status: DaemonStatus): boolean {
  if (status.lastTickAt === null) return true;
  return new Date(status.now).getTime() - new Date(status.lastTickAt).getTime() > STALE_TICK_MS;
}

export function getDaemonHealth(status: DaemonStatus | undefined, hasError: boolean): DaemonHealth {
  if (hasError || status === undefined) return 'unreachable';
  return checkIsTickStale(status) ? 'stale' : 'healthy';
}

export function checkIsDiskLow(disk: DiskSpace): boolean {
  return disk.freeBytes < LOW_DISK_BYTES;
}

// Decimal units, as Finder and Disk Utility count them.
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const exponent = Math.min(BYTE_UNITS.length, Math.floor(Math.log10(bytes) / 3));
  const value = bytes / 1000 ** exponent;
  return new Intl.NumberFormat('en', {
    style: 'unit',
    unit: BYTE_UNITS[exponent - 1],
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

export function formatDiskSpace(disk: DiskSpace): string {
  return `${formatBytes(disk.freeBytes)} free of ${formatBytes(disk.totalBytes)}`;
}

export function formatCpuLoad(load: number | null): string {
  return load === null ? '-' : percentFormatter.format(load);
}

// A limit past its reset is left out: what was used since is unknown until the next run reports it.
export function getCurrentUsageLimits(
  usage: PlanUsage | null | undefined,
  now: number,
): CurrentUsageLimit[] {
  if (!usage) return [];
  const limits = [
    { label: '5-hour limit', limit: usage.session },
    { label: 'Weekly limit', limit: usage.week },
  ];
  return limits.flatMap(({ label, limit }) =>
    limit !== null && new Date(limit.resetsAt).getTime() > now ? [{ ...limit, label }] : [],
  );
}

export function getClaudeLimits(status: DaemonStatus): CurrentUsageLimit[] {
  return getCurrentUsageLimits(status.claudeUsage, new Date(status.now).getTime());
}

export function getMostUsedLimit(limits: CurrentUsageLimit[]): CurrentUsageLimit | undefined {
  return limits.reduce<CurrentUsageLimit | undefined>(
    (most, limit) => (most === undefined || limit.usedRatio > most.usedRatio ? limit : most),
    undefined,
  );
}

export function getLeftRatio(limit: UsageLimit): number {
  return Math.min(1, Math.max(0, 1 - limit.usedRatio));
}

export function formatUsageLeft(limit: UsageLimit): string {
  return percentFormatter.format(getLeftRatio(limit));
}

export function checkIsUsageLow(limit: UsageLimit): boolean {
  return getLeftRatio(limit) < LOW_USAGE_LEFT;
}
