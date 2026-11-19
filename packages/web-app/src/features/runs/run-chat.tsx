import { useRef } from 'react';
import { Spinner } from 'design-system/components';
import { useDebouncedValue } from 'design-system/utils';
import { getAgentLabel } from 'domains/agent/utils';
import { RunMessageForm } from 'domains/run/components';
import type { RunWithTranscript } from 'domains/run/types';
import { checkCanContinueRun, checkIsRunActive } from 'domains/run/utils';
import { TranscriptList } from 'domains/transcript/components';
import { useStickToBottom } from '@web-app/hooks/use-stick-to-bottom';
import { useTextSearch } from '@web-app/hooks/use-text-search';
import { TranscriptSearch } from './transcript-search';

const SEARCH_DELAY_MS = 150;

interface RunChatProps extends RunWithTranscript {
  searchValue: string | null;
  onSearchValueChange: (value: string) => void;
  onSearchClose: () => void;
}

export function RunChat({
  run,
  transcript,
  searchValue,
  onSearchValueChange,
  onSearchClose,
}: RunChatProps) {
  const stickToBottom = useStickToBottom(transcript.eventCount);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(searchValue?.trim() ?? '', SEARCH_DELAY_MS);
  const search = searchValue === null ? '' : debouncedSearch;
  const textSearch = useTextSearch(transcriptRef, search);

  return (
    <div className="space-y-6">
      {searchValue !== null && (
        <div className="top-below-headers sticky z-20 flex justify-end bg-page py-2">
          <TranscriptSearch
            value={searchValue}
            matchCount={search === searchValue.trim() ? textSearch.count : null}
            current={textSearch.current}
            onValueChange={onSearchValueChange}
            onMove={textSearch.move}
            onClose={onSearchClose}
          />
        </div>
      )}
      <div ref={transcriptRef}>
        <TranscriptList
          items={transcript.items}
          isRunning={checkIsRunActive(run)}
          search={search}
        />
      </div>
      {run.replyPid !== null && (
        <div role="status" className="flex items-center gap-2 text-body-sm text-fg-muted">
          <Spinner />
          {getAgentLabel(run.agent)} is replying
        </div>
      )}
      <div className="sticky bottom-0 z-10 bg-linear-to-t from-page from-70% to-transparent pt-6 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]">
        {checkCanContinueRun(run) ? (
          <RunMessageForm run={run} onSent={stickToBottom} />
        ) : (
          <p className="text-body-sm text-fg-muted">This run has no agent session to continue.</p>
        )}
      </div>
    </div>
  );
}
