import { ArrowRight, CheckCircle2, ChevronRight, History } from 'lucide-react';
import { CodeLine, FIX_E2E_TESTS_LINES, WindowCard } from '../code-window';
import { AccentText } from '../heading';

interface TranscriptStep {
  tool: string;
  input: string;
}

// A run of routines/fix-e2e-tests.md, as the dashboard's transcript shows it.
const STEPS: TranscriptStep[] = [
  { tool: 'Bash', input: 'gh run view 4182 --log-failed' },
  { tool: 'Read', input: 'e2e/checkout.e2e.ts' },
  { tool: 'Edit', input: 'e2e/checkout.e2e.ts' },
  { tool: 'Bash', input: 'pnpm test:e2e checkout --repeat-each 10' },
  { tool: 'Bash', input: 'gh pr create --fill' },
];

function RunCard() {
  return (
    <div className="flex w-111.5 shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <History className="size-5 text-fg-muted" />
        <span className="font-mono text-[18px] font-semibold">fix-e2e-tests</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-md bg-positive-soft px-2 py-0.5 text-[14px] font-medium text-positive">
          <span className="size-1.5 rounded-full bg-positive" />
          Succeeded
        </span>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        <span className="text-[15px] text-fg-muted">Transcript</span>
        <p className="truncate text-[14.5px] text-fg-prose">
          The checkout test failed in the last e2e run.
        </p>
        {STEPS.map(step => (
          <div
            key={`${step.tool} ${step.input}`}
            className="flex items-center gap-2 font-mono text-[13.5px]"
          >
            <ChevronRight className="size-4 shrink-0 text-fg-faint" />
            <span className="font-semibold text-fg">{step.tool}</span>
            <span className="truncate text-fg-secondary">{step.input}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2 rounded-lg bg-positive-soft px-3 py-2.5 text-[14.5px]">
          <CheckCircle2 className="size-4.5 text-positive" />
          <span className="font-medium text-positive">Finished</span>
          <span className="text-fg-secondary">· 24 turns · 12m 0s</span>
        </div>
      </div>
    </div>
  );
}

function GlowArrow() {
  return (
    <div className="relative flex w-19 shrink-0 items-center">
      <div className="absolute inset-x-1 h-4 rounded-full bg-linear-to-r from-brand-violet to-brand-peach opacity-60 blur-lg" />
      <div className="h-0.75 flex-1 rounded-full bg-linear-to-r from-brand-violet to-brand-peach" />
      <ArrowRight className="-ml-3 size-7 text-brand-peach" strokeWidth={2.5} />
    </div>
  );
}

// The YouTube thumbnail: big enough to read in a list of small previews.
export function ThumbnailStill() {
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-16">
      <h1 className="text-[76px] leading-21 font-semibold tracking-[-0.035em]">
        AI agents that work <AccentText>24/7</AccentText>
      </h1>
      <p className="mt-2 text-[38px] leading-11.5 tracking-[-0.02em] text-fg-secondary">
        From Markdown files in your repo
      </p>
      <div className="mt-12 flex items-center gap-4">
        <WindowCard folder="routines/" file="fix-e2e-tests.md" className="w-153 shrink-0">
          <div className="py-4 pr-4 pl-1 font-mono text-[13.5px]">
            {FIX_E2E_TESTS_LINES.map((tokens, index) => (
              <CodeLine
                key={index}
                number={index + 1}
                tokens={tokens}
                className="h-6.25 leading-6.25"
              />
            ))}
          </div>
        </WindowCard>
        <GlowArrow />
        <RunCard />
      </div>
    </div>
  );
}
