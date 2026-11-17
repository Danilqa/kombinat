import { Spinner } from 'design-system/components';
import { getAgentLabel } from 'domains/agent/utils';
import { RunMessageForm } from 'domains/run/components';
import type { RunWithTranscript } from 'domains/run/types';
import { checkCanContinueRun, checkIsRunActive } from 'domains/run/utils';
import { TranscriptList } from 'domains/transcript/components';
import { useStickToBottom } from '@web-app/hooks/use-stick-to-bottom';

interface RunChatProps extends RunWithTranscript {}

export function RunChat({ run, transcript }: RunChatProps) {
  const stickToBottom = useStickToBottom(transcript.eventCount);
  return (
    <div className="space-y-6">
      <TranscriptList items={transcript.items} isRunning={checkIsRunActive(run)} />
      {run.replyPid !== null && (
        <div role="status" className="flex items-center gap-2 text-body-sm text-fg-muted">
          <Spinner />
          {getAgentLabel(run.agent)} is replying
        </div>
      )}
      <div className="sticky bottom-0 z-10 bg-linear-to-t from-page from-70% to-transparent pt-6 pb-4">
        {checkCanContinueRun(run) ? (
          <RunMessageForm run={run} onSent={stickToBottom} />
        ) : (
          <p className="text-body-sm text-fg-muted">This run has no agent session to continue.</p>
        )}
      </div>
    </div>
  );
}
