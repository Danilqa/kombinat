import { LOW_DISK_BYTES, STALE_TICK_MS } from './constants';
import type { DaemonHealth, DaemonStatus, DiskSpace } from './types';

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
