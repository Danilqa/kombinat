import { Card, SectionHeader, DayBar, Stat } from 'design-system';
import type { TokenCounts, TokenDay, TokenUsage } from 'domains/run/types';
import { formatTokens, formatTokenShare, getTokenTotal, parseLocalDate } from 'domains/run/utils';
import { formatDayMonth, formatWeekday } from 'utils/date-time';

interface TokenDayBarProps {
  day: TokenDay;
  maxTotal: number;
  isToday: boolean;
}

function TokenDayBar({ day, maxTotal, isToday }: TokenDayBarProps) {
  const date = parseLocalDate(day.date);
  return (
    <DayBar
      label={`${formatWeekday(date)} ${formatDayMonth(date)}: ${formatTokens(day.total)} tokens`}
      segments={[{ value: day.total, className: isToday ? 'bg-fg' : 'bg-fg-faint' }]}
      maxTotal={maxTotal}
      caption={formatWeekday(date)}
    />
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
      <Card.Root>
        <div className="flex flex-col gap-6 p-4 md:flex-row md:items-end md:gap-10">
          <dl className="grid shrink-0 grid-cols-3 gap-6 md:w-96">
            <Stat
              label="Used"
              value={formatTokens(total)}
              note={`${usage.runs} ${usage.runs === 1 ? 'run' : 'runs'}`}
            />
            <Stat
              label="Per run"
              value={formatTokens(Math.round(total / usage.runs))}
              note="on average"
            />
            <Stat label="Share" value={formatTokenShare(usage.share)} note="of all routines" />
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
