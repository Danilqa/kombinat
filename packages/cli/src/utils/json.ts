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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJsonFile<T>(file: string, schema: z.ZodType<T>): T | null {
  if (!fs.existsSync(file)) return null;
  const parsed = schema.safeParse(parseJson(fs.readFileSync(file, 'utf8')));
  return parsed.success ? parsed.data : null;
}

export function writeJsonFile(file: string, value: unknown): void {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
