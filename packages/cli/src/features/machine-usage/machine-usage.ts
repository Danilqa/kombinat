import fs from 'node:fs';
import os from 'node:os';

import type { DiskSpace } from 'domains/daemon/types';

const CPU_SAMPLE_MS = 5_000;

export interface CpuTimes {
  idle: number;
  total: number;
}

let cpuLoad: number | null = null;

function readCpuTimes(): CpuTimes {
  return os.cpus().reduce(
    (sum, { times }) => ({
      idle: sum.idle + times.idle,
      total: sum.total + times.user + times.nice + times.sys + times.idle + times.irq,
    }),
    { idle: 0, total: 0 },
  );
}

export function getCpuLoad(previous: CpuTimes, next: CpuTimes): number | null {
  const total = next.total - previous.total;
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, 1 - (next.idle - previous.idle) / total));
}

export function startCpuSampling(): () => void {
  let previous = readCpuTimes();
  const timer = setInterval(() => {
    const next = readCpuTimes();
    cpuLoad = getCpuLoad(previous, next);
    previous = next;
  }, CPU_SAMPLE_MS);
  timer.unref();
  return () => clearInterval(timer);
}

export function readCpuLoad(): number | null {
  return cpuLoad;
}

export function readDiskSpace(dir: string): DiskSpace | null {
  try {
    const { bavail, blocks, bsize } = fs.statfsSync(dir);
    return { freeBytes: bavail * bsize, totalBytes: blocks * bsize };
  } catch {
    return null;
  }
}
