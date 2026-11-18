import fs from 'node:fs';

import type { z } from 'zod';

export function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

export function checkIsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJsonFile<T>(file: string, schema: z.ZodType<T>): T | null {
  if (!fs.existsSync(file)) return null;
  const parsed = schema.safeParse(parseJson(fs.readFileSync(file, 'utf8')));
  return parsed.success ? parsed.data : null;
}

// Runs that write the same file at once each rename their own temporary file.
export function writeJsonFile(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
