export const MINUTES_PER_DAY = 24 * 60;
export const MIN_BLOCK_MINUTES = 25;

const MINUTE_MS = 60_000;

export interface TimedEntry {
  id: string;
  start: string;
  end: string;
}

export interface PositionedEntry<T extends TimedEntry> {
  entry: T;
  top: number;
  height: number;
  left: number;
  width: number;
}

interface Placement<T extends TimedEntry> {
  entry: T;
  top: number;
  height: number;
  column: number;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function getDayStart(date: Date): Date {
  return addDays(date, 0);
}

export function getWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function getWeekStart(date: Date): Date {
  return addDays(date, -getWeekdayIndex(date));
}

export function checkIsSameDay(a: Date, b: Date): boolean {
  return getDayStart(a).getTime() === getDayStart(b).getTime();
}

export function getMinutesIntoDay(time: Date, dayStart: Date): number {
  return (time.getTime() - dayStart.getTime()) / MINUTE_MS;
}

function placeInDay<T extends TimedEntry>(
  entry: T,
  dayStart: Date,
  dayEnd: Date,
): Omit<Placement<T>, 'column'> | null {
  const start = Math.max(new Date(entry.start).getTime(), dayStart.getTime());
  const end = Math.min(new Date(entry.end).getTime(), dayEnd.getTime());
  if (end <= start) return null;
  const height = Math.max(MIN_BLOCK_MINUTES, (end - start) / MINUTE_MS);
  const top = Math.min(getMinutesIntoDay(new Date(start), dayStart), MINUTES_PER_DAY - height);
  return { entry, top, height };
}

function assignColumns<T extends TimedEntry>(
  cluster: Array<Omit<Placement<T>, 'column'>>,
): Array<PositionedEntry<T>> {
  const columnBottoms: number[] = [];
  const placements = cluster.map(item => {
    const freeColumn = columnBottoms.findIndex(bottom => bottom <= item.top);
    const column = freeColumn === -1 ? columnBottoms.length : freeColumn;
    columnBottoms[column] = item.top + item.height;
    return { ...item, column };
  });
  const columns = columnBottoms.length;
  return placements.map(({ entry, top, height, column }) => ({
    entry,
    top,
    height,
    left: column / columns,
    width: 1 / columns,
  }));
}

export function layoutDay<T extends TimedEntry>(
  entries: T[],
  dayStart: Date,
): Array<PositionedEntry<T>> {
  const dayEnd = addDays(dayStart, 1);
  const items = entries
    .map(entry => placeInDay(entry, dayStart, dayEnd))
    .filter(item => item !== null)
    .sort((a, b) => a.top - b.top || b.height - a.height);
  const clusters: Array<typeof items> = [];
  let clusterBottom = -Infinity;
  for (const item of items) {
    const isNewCluster = item.top >= clusterBottom;
    const current = clusters.at(-1);
    if (isNewCluster || current === undefined) clusters.push([item]);
    else current.push(item);
    clusterBottom = isNewCluster
      ? item.top + item.height
      : Math.max(clusterBottom, item.top + item.height);
  }
  return clusters.flatMap(cluster => assignColumns(cluster));
}
