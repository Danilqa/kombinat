export type Random = () => number;

function hashString(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Seeded, so a run looks the same on every poll and every reload.
export function createRandom(seed: string): Random {
  let state = hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function randomHex(random: Random, length: number): string {
  return Array.from({ length }, () => randomInt(random, 0, 15).toString(16)).join('');
}

export function randomUuid(random: Random): string {
  return [8, 4, 4, 4, 12].map(length => randomHex(random, length)).join('-');
}

export function randomId(random: Random, length: number): string {
  return Array.from({ length }, () => randomInt(random, 0, 35).toString(36)).join('');
}
