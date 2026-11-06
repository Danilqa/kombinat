// The dashboard palette (packages/web-app/src/index.css), so the terminal and the browser look alike.
const PALETTE = {
  page: '#09090a',
  surface: '#111113',
  raised: '#18181b',
  overlay: '#222226',
  fg: '#ececee',
  prose: '#cfcfd3',
  secondary: '#a3a3a9',
  muted: '#8b8b92',
  faint: '#47474d',
  positive: '#4cc38a',
  negative: '#f2555a',
  warning: '#f0913f',
  info: '#6b9cff',
  accent: '#f07846',
} as const;

export type ThemeColor = keyof typeof PALETTE;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const CUBE_STEPS = [0, 95, 135, 175, 215, 255];

function toRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function distance(left: Rgb, right: Rgb): number {
  return (left.r - right.r) ** 2 + (left.g - right.g) ** 2 + (left.b - right.b) ** 2;
}

function nearestStep(channel: number): number {
  return CUBE_STEPS.reduce(
    (best, step, index) =>
      Math.abs(step - channel) < Math.abs((CUBE_STEPS[best] ?? 0) - channel) ? index : best,
    0,
  );
}

// The closest of the 216 cube colours and the 24 greys, for terminals without 24-bit colour.
function toAnsi256(rgb: Rgb): number {
  const [r, g, b] = [nearestStep(rgb.r), nearestStep(rgb.g), nearestStep(rgb.b)];
  const cube = { r: CUBE_STEPS[r] ?? 0, g: CUBE_STEPS[g] ?? 0, b: CUBE_STEPS[b] ?? 0 };
  const greyLevel = Math.min(23, Math.max(0, Math.round(((rgb.r + rgb.g + rgb.b) / 3 - 8) / 10)));
  const greyValue = 8 + greyLevel * 10;
  const grey = { r: greyValue, g: greyValue, b: greyValue };
  return distance(rgb, grey) < distance(rgb, cube) ? 232 + greyLevel : 16 + 36 * r + 6 * g + b;
}

const isTruecolor = /^(truecolor|24bit)$/i.test(process.env['COLORTERM'] ?? '');

function color(layer: 38 | 48, name: ThemeColor): string {
  const rgb = toRgb(PALETTE[name]);
  return isTruecolor ? `${layer};2;${rgb.r};${rgb.g};${rgb.b}` : `${layer};5;${toAnsi256(rgb)}`;
}

export const fg = (name: ThemeColor): string => color(38, name);
export const bg = (name: ThemeColor): string => color(48, name);

// Every cell starts from the page: dark background, regular text.
export const BASE = `${bg('page')};${fg('fg')}`;
