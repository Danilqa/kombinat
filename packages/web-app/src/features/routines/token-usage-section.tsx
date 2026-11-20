import { useState } from 'react';
import { Card, Tooltip } from 'design-system/components';
import { SectionHeader } from 'design-system/layouts';
import { cn } from 'design-system/utils';
import type { TokenCounts, TokenDay, TokenUsage } from 'domains/run/types';
import { formatTokens, formatTokenShare, getTokenTotal, parseLocalDate } from 'domains/run/utils';
import { formatDayMonth, formatWeekday } from 'utils/date-time';

interface TokenStatProps {
  label: string;
  value: string;
  note: string;
}

function TokenStat({ label, value, note }: TokenStatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-body-sm text-fg-muted">{label}</dt>
      <dd className="space-y-0.5">
        <div className="text-title-sm font-medium text-fg tabular-nums">{value}</div>
        <div className="text-body-sm text-fg-muted">{note}</div>
      </dd>
    </div>
  );
}

interface TokenDayBarProps {
  day: TokenDay;
  maxTotal: number;
  isToday: boolean;
}

function TokenDayBar({ day, maxTotal, isToday }: TokenDayBarProps) {
  const date = parseLocalDate(day.date);
  const label = `${formatWeekday(date)} ${formatDayMonth(date)}: ${formatTokens(day.total)} tokens`;
  const height = maxTotal === 0 ? 0 : (day.total / maxTotal) * 100;
  const barColor = day.total === 0 ? 'bg-line-strong' : isToday ? 'bg-fg' : 'bg-fg-faint';
  const [isOpen, setIsOpen] = useState(false);
  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
        {/* Radix closes a tooltip on click and ignores taps. Here a click or tap opens it. */}
        <Tooltip.Trigger
          asChild
          onClick={event => {
            event.preventDefault();
            setIsOpen(true);
          }}
        >
          <div
            role="img"
            aria-label={label}
            tabIndex={0}
            className="flex h-16 w-full cursor-default items-end rounded-sm"
          >
            <div
              className={cn('w-full rounded-sm', barColor)}
              style={{ height: `max(${height}%, 2px)` }}
            />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content>{label}</Tooltip.Content>
      </Tooltip.Root>
      <span aria-hidden="true" className="text-body-sm text-fg-muted">
        {formatWeekday(date)}
      </span>
    </li>
  );
}

const TOKEN_KINDS: [keyof TokenCounts, string][] = [
  ['input', 'Input'],
  ['output', 'Output'],
  ['cacheWrite', 'Cache write'],
  ['cacheRead', 'Cache read'],
];

interface TokenUsageSectionProps {
  usage: TokenUsage;
}

export function TokenUsageSection({ usage }: TokenUsageSectionProps) {
  const total = getTokenTotal(usage.counts);
  const maxDayTotal = Math.max(...usage.days.map(day => day.total));
  return (
    <section>
      <SectionHeader.Root aside={<SectionHeader.Aside>Includes cache reads</SectionHeader.Aside>}>
        Tokens, last 7 days
      </SectionHeader.Root>
      <Card.Root className="gap-0 py-0">
        <div className="flex flex-col gap-6 p-4 md:flex-row md:items-end md:gap-10">
          <dl className="grid shrink-0 grid-cols-3 gap-6 md:w-96">
            <TokenStat
              label="Used"
              value={formatTokens(total)}
              note={`${usage.runs} ${usage.runs === 1 ? 'run' : 'runs'}`}
            />
            <TokenStat
              label="Per run"
              value={formatTokens(Math.round(total / usage.runs))}
              note="on average"
            />
            <TokenStat label="Share" value={formatTokenShare(usage.share)} note="of all routines" />
          </dl>
          <ol aria-label="Tokens per day" className="flex min-w-0 flex-1 gap-1.5 sm:gap-2">
            {usage.days.map((day, index) => (
              <TokenDayBar
                key={day.date}
                day={day}
                maxTotal={maxDayTotal}
                isToday={index === usage.days.length - 1}
              />
            ))}
          </ol>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line-faint px-4 py-3 text-body-sm">
          {TOKEN_KINDS.map(([kind, label]) => (
            <div key={kind} className="flex gap-1.5">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="text-fg tabular-nums">{formatTokens(usage.counts[kind])}</dd>
            </div>
          ))}
        </dl>
      </Card.Root>
    </section>
  );
}
