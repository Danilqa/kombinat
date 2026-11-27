import type { InsightsDay } from 'domains/insights/types';
import { formatTokens } from 'domains/run/utils';
import type { DayChartBar } from './day-chart-section';

function getBarClassName(index: number, days: InsightsDay[]): string {
  return index === days.length - 1 ? 'bg-fg' : 'bg-fg-faint';
}

export function getTokenBars(days: InsightsDay[]): DayChartBar[] {
  return days.map((day, index) => ({
    date: day.date,
    segments: [{ value: day.tokens, className: getBarClassName(index, days) }],
    summary: `${formatTokens(day.tokens)} tokens`,
  }));
}

export function getRunBars(days: InsightsDay[]): DayChartBar[] {
  return days.map((day, index) => ({
    date: day.date,
    segments: [
      { value: day.failed, className: 'bg-negative' },
      { value: day.runs - day.failed, className: getBarClassName(index, days) },
    ],
    summary: [
      `${day.runs} ${day.runs === 1 ? 'run' : 'runs'}`,
      ...(day.failed > 0 ? [`${day.failed} failed`] : []),
    ].join(', '),
  }));
}
