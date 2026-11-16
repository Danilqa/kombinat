import { CheckCircle2, LoaderCircle, Webhook } from 'lucide-react';
import { cn } from 'design-system/utils';
import { BotAvatar } from '../components/bot-avatar';
import { CodeLine, type CodeToken } from '../components/code-line';
import { FlowArrow } from '../components/flow-arrow';
import { SceneHeading } from '../components/scene-heading';
import { WindowCard } from '../components/window-card';
import { getProgress, toPopStyle, toRiseStyle } from '../motion';

const REQUEST_BODY: CodeToken[][] = [
  [{ text: '{', tone: 'faint' }],
  [
    { text: '  "issue": ', tone: 'key' },
    { text: '"ACME-142"', tone: 'string' },
    { text: ',', tone: 'faint' },
  ],
  [
    { text: '  "title": ', tone: 'key' },
    { text: '"CSV export times out"', tone: 'string' },
    { text: ',', tone: 'faint' },
  ],
  [
    { text: '  "comment": ', tone: 'key' },
    { text: '"@kombinat take this one"', tone: 'string' },
  ],
  [{ text: '}', tone: 'faint' }],
];

const ROUTINE_LINES: CodeToken[][] = [
  [{ text: '---', tone: 'faint' }],
  [
    { text: 'name: ', tone: 'key' },
    { text: 'agent-tasks', tone: 'value' },
  ],
  [
    { text: 'schedule: ', tone: 'key' },
    { text: 'manual', tone: 'value' },
  ],
  [
    { text: 'webhook: ', tone: 'key' },
    { text: 'true', tone: 'string' },
  ],
  [{ text: '---', tone: 'faint' }],
  [{ text: 'Do the task from the request,', tone: 'prose' }],
  [{ text: 'open a draft pull request and', tone: 'prose' }],
  [{ text: 'reply where you were asked.', tone: 'prose' }],
];

const APPENDED_BODY: CodeToken[] = [{ text: '{"issue":"ACME-142", …}', tone: 'added' }];
const WEBHOOK_LINE = 3;

interface RunStep {
  tool: string;
  input: string;
  start: number;
}

const RUN_STEPS: RunStep[] = [
  { tool: 'Read', input: 'src/export/csv.ts', start: 3.5 },
  { tool: 'Edit', input: 'src/export/csv.ts', start: 4.05 },
  { tool: 'Bash', input: 'pnpm test export', start: 4.6 },
  { tool: 'Bash', input: 'gh pr create --draft', start: 5.15 },
];

const FINISHED_AT = 5.8;

interface RequestCardProps {
  time: number;
}

function RequestCard({ time }: RequestCardProps) {
  return (
    <div
      style={toPopStyle(getProgress(time, 0.5, 0.5))}
      className="flex h-[292px] w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="flex h-10 items-center gap-2 border-b border-line px-4 font-mono text-[12px]">
        <Webhook className="size-4 shrink-0 text-brand-pink" />
        <span className="font-semibold text-brand-peach">POST</span>
        <span className="truncate text-fg-secondary">/api/routines/agent-tasks/webhook</span>
      </div>
      <div className="flex-1 px-4 py-3.5 font-mono text-[13px] leading-[24px]">
        {REQUEST_BODY.map((tokens, index) => (
          <CodeLine key={index} tokens={tokens} />
        ))}
      </div>
      <div
        style={{ opacity: getProgress(time, 1.3, 0.4) }}
        className="flex items-center gap-2 border-t border-line px-4 py-3 font-mono text-[12px] text-fg-muted"
      >
        <span className="rounded bg-positive-soft px-1.5 text-positive">200</span>
        {'{"ok":true,"runId":"…"}'}
      </div>
    </div>
  );
}

interface RoutineCardProps {
  time: number;
}

function RoutineCard({ time }: RoutineCardProps) {
  const highlight = getProgress(time, 1.7, 0.4);
  const appended = getProgress(time, 2.4, 0.5);
  return (
    <WindowCard
      folder="routines/"
      file="agent-tasks.md"
      style={toPopStyle(getProgress(time, 1, 0.5))}
      className="h-[292px] w-[340px] shrink-0"
    >
      <div className="px-4 py-3 font-mono text-[13px] leading-[24px]">
        {ROUTINE_LINES.map((tokens, index) => (
          <CodeLine
            key={index}
            tokens={tokens}
            className="-mx-2 rounded px-2"
            style={{
              backgroundColor: `rgba(245, 176, 138, ${index === WEBHOOK_LINE ? highlight * 0.14 : 0})`,
            }}
          />
        ))}
        <CodeLine
          tokens={APPENDED_BODY}
          className="-mx-2 rounded bg-positive-soft px-2"
          style={toRiseStyle(appended, 8)}
        />
      </div>
    </WindowCard>
  );
}

interface RunCardProps {
  time: number;
}

function RunCard({ time }: RunCardProps) {
  const isFinished = time >= FINISHED_AT;
  return (
    <div
      style={toPopStyle(getProgress(time, 2.9, 0.5))}
      className="flex h-[292px] w-[340px] shrink-0 flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[15px] font-semibold">agent-tasks</span>
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-medium',
            isFinished ? 'bg-positive-soft text-positive' : 'bg-warning-soft text-warning',
          )}
        >
          {isFinished ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <LoaderCircle className="size-3.5" style={{ transform: `rotate(${time * 360}deg)` }} />
          )}
          {isFinished ? 'Succeeded' : 'Running'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex items-center gap-1.5 rounded-md bg-raised px-2 py-0.5 text-fg-secondary">
          <Webhook className="size-3.5" />
          Webhook
        </span>
        <span
          style={{ opacity: getProgress(time, 3.3, 0.4) }}
          className="rounded-md bg-raised px-2 py-0.5 text-fg-secondary"
        >
          1 queued
        </span>
      </div>
      <div className="flex flex-col gap-2 font-mono text-[13px]">
        {RUN_STEPS.map(step => (
          <div
            key={`${step.tool} ${step.input}`}
            style={toRiseStyle(getProgress(time, step.start, 0.35), 6)}
            className="flex gap-2.5 rounded-lg bg-raised px-3 py-1.5"
          >
            <span className="w-9 shrink-0 font-semibold text-fg">{step.tool}</span>
            <span className="truncate text-fg-secondary">{step.input}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[13px] text-fg-muted">
        {isFinished ? 'Finished in 9 min.' : 'Started just now'}
      </div>
    </div>
  );
}

interface OutcomeProps {
  time: number;
}

function Outcome({ time }: OutcomeProps) {
  return (
    <div
      style={toRiseStyle(getProgress(time, 6.2, 0.5), 12)}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pr-5 pl-3"
    >
      <BotAvatar />
      <span className="font-mono text-[14px] text-fg-muted">ACME-142</span>
      <span className="rounded-full bg-[rgba(185,168,255,0.16)] px-2.5 py-0.5 text-[13px] font-medium text-brand-violet">
        In review
      </span>
      <span className="text-[15px] text-fg-prose">
        Opened draft PR #513: the export now streams rows in pages of 1,000.
      </span>
    </div>
  );
}

interface WebhookSceneProps {
  time: number;
}

export function WebhookScene({ time }: WebhookSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-[60px]">
      <SceneHeading
        time={time}
        title="A webhook starts"
        accent="the routine"
        subtitle="The request body goes into the prompt."
      />
      <div className="mt-10 flex items-center gap-3.5">
        <RequestCard time={time} />
        <FlowArrow progress={getProgress(time, 0.9, 0.3)} />
        <RoutineCard time={time} />
        <FlowArrow progress={getProgress(time, 2.8, 0.3)} />
        <RunCard time={time} />
      </div>
      <div className="mt-8">
        <Outcome time={time} />
      </div>
    </div>
  );
}
