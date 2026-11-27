import { Check, Clock, GitMerge, GitPullRequest } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from 'design-system';
import { Avatar } from '../../avatar';
import { FlowArrow } from '../../flow-arrow';
import { SceneHeading } from '../../heading';
import { getProgress, toPopStyle, toRiseStyle } from '../../motion';
import { MacMiniIcon } from './mac-mini-icon';

const ROLES = ['Engineer', 'Designer', 'PM', 'GTM'];
const AUTHOR = 'Designer';

interface StepCardProps {
  progress: number;
  icon: ReactNode;
  title: ReactNode;
  note?: ReactNode;
  className?: string;
}

function StepCard({ progress, icon, title, note, className }: StepCardProps) {
  return (
    <div
      style={toPopStyle(progress)}
      className={cn(
        'flex shrink-0 flex-col items-center gap-2 rounded-xl border border-line bg-surface px-4 py-4 text-center',
        className,
      )}
    >
      {icon}
      <div className="text-[16px] leading-5.25 font-semibold">{title}</div>
      {note !== undefined && <div className="text-[13px] leading-4.5 text-fg-muted">{note}</div>}
    </div>
  );
}

interface TeamFlowSceneProps {
  time: number;
}

export function TeamFlowScene({ time }: TeamFlowSceneProps) {
  const isAuthorPicked = time >= 0.9;
  const isMerged = time >= 2.7;
  const clockPulse = getProgress(time, 4.6, 0.8);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-16 pb-6">
      <SceneHeading
        time={time}
        title="Anyone on the team can"
        accent="add a routine"
        subtitle="One repo. A pull request is how a routine ships."
      />
      <div className="flex items-center gap-2.5">
        <div className="flex flex-col gap-2" style={toRiseStyle(getProgress(time, 0.4, 0.5))}>
          {ROLES.map(role => (
            <div
              key={role}
              className={cn(
                'flex w-33 items-center gap-2.5 rounded-full border bg-surface py-1.5 pr-4 pl-1.5 text-[15px] transition-none',
                isAuthorPicked && role === AUTHOR
                  ? 'border-brand-pink text-fg shadow-[0_0_0_1px_var(--color-brand-pink)]'
                  : 'border-line text-fg-secondary',
              )}
            >
              <Avatar initial={role.charAt(0)} isAccent={isAuthorPicked && role === AUTHOR} />
              {role}
            </div>
          ))}
        </div>
        <FlowArrow progress={getProgress(time, 1.05, 0.3)} />
        <div
          style={toPopStyle(getProgress(time, 1.15, 0.5))}
          className="flex w-78 shrink-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <GitPullRequest className="size-4.5 text-fg-muted" />
            Add routines/design-ux-issues.md
          </div>
          <div className="rounded-lg bg-positive-soft px-3 py-2 font-mono text-[13px] leading-5.25 text-positive">
            <div>+ routines/design-ux-issues.md</div>
            <div>+ schedule: &apos;30 3 * * *&apos;</div>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-fg-muted">
            <Avatar initial="D" isAccent className="size-6 text-[11px]" />
            Designer opened
            <span
              className={cn(
                'ml-auto flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium',
                isMerged
                  ? 'bg-brand-violet/16 text-brand-violet'
                  : 'bg-positive-soft text-positive',
              )}
            >
              {isMerged ? (
                <GitMerge className="size-3.5" />
              ) : (
                <GitPullRequest className="size-3.5" />
              )}
              {isMerged ? 'Merged' : 'Open'}
            </span>
          </div>
        </div>
        <FlowArrow progress={getProgress(time, 1.95, 0.3)} />
        <div
          style={toPopStyle(getProgress(time, 2.05, 0.5))}
          className="flex w-32 shrink-0 flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3.5"
        >
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Avatar initial="E" className="size-6 text-[11px]" />
            Engineer
          </div>
          <div className="flex items-center gap-1.5 text-[14px] text-positive">
            <Check className="size-4" />
            Approved
          </div>
        </div>
        <FlowArrow progress={getProgress(time, 2.75, 0.3)} />
        <StepCard
          progress={getProgress(time, 2.85, 0.5)}
          icon={<GitMerge className="size-6 text-brand-pink" />}
          title={
            <>
              Merged into
              <br />
              main
            </>
          }
          className="w-32"
        />
        <FlowArrow progress={getProgress(time, 3.45, 0.3)} />
        <StepCard
          progress={getProgress(time, 3.55, 0.5)}
          icon={<MacMiniIcon className="h-6 w-11 text-fg" />}
          title="Mac mini"
          note={
            <>
              pulls main
              <br />
              every 5 minutes
            </>
          }
          className="w-35"
        />
        <FlowArrow progress={getProgress(time, 4.15, 0.3)} />
        <StepCard
          progress={getProgress(time, 4.25, 0.5)}
          icon={
            <Clock
              className="size-6 text-positive"
              style={{ transform: `scale(${1 + Math.sin(clockPulse * Math.PI) * 0.25})` }}
            />
          }
          title={
            <>
              Routine runs on
              <br />
              its schedule
            </>
          }
          className="w-38 px-3"
        />
      </div>
    </div>
  );
}
