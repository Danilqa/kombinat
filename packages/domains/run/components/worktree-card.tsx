import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, FolderGit2, GitBranch, Loader, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { isMatching, match } from 'ts-pattern';

import { Button } from 'design-system/components';
import { cn } from 'design-system/utils';
import { sameOriginApi } from 'utils/http';

import { QUERY_KEYS_CHANGED_BY_WORKTREE } from '../constants';
import { removeRunWorktree } from '../requests';
import type { RunRecord, RunWorktree, WorktreeChanges } from '../types';
import { checkIsRunActive, getWorktreeChangesLabel } from '../utils';

const COPIED_MS = 1500;
const SHOWN_FILES = 5;

const quoteForShell = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
const countMoreFiles = (count: number) => `${count} more ${count === 1 ? 'file' : 'files'}`;

interface LineCountsProps {
  added: number | null;
  removed: number | null;
}

function LineCounts({ added, removed }: LineCountsProps) {
  if (added === null || removed === null) return null;
  return (
    <span className="flex shrink-0 gap-1.5 font-mono text-caption tabular-nums">
      <span className="text-positive">+{added}</span>
      <span className="text-negative">&minus;{removed}</span>
    </span>
  );
}

interface ChangedFilesProps {
  changes: WorktreeChanges;
}

function ChangedFiles({ changes }: ChangedFilesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shown = isExpanded ? changes.files : changes.files.slice(0, SHOWN_FILES);
  const hiddenCount = changes.files.length - shown.length;
  const unlistedCount = changes.fileCount - changes.files.length;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line-faint sm:ml-6">
      {shown.length > 0 && (
        <ul aria-label="Changed files" className="divide-y divide-line-faint">
          {shown.map(file => (
            <li key={file.path} className="flex items-baseline gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 font-mono text-caption wrap-anywhere text-fg-secondary">
                {file.path}
              </span>
              <LineCounts added={file.added} removed={file.removed} />
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="w-full cursor-pointer border-t border-line-faint px-3 py-2 text-left text-caption text-fg-muted transition-colors interactive:hover:bg-hover interactive:hover:text-fg"
          onClick={() => setIsExpanded(true)}
        >
          Show {countMoreFiles(hiddenCount)}
        </button>
      )}
      {hiddenCount === 0 && unlistedCount > 0 && (
        <p className="border-t border-line-faint px-3 py-2 text-caption text-fg-muted">
          {countMoreFiles(unlistedCount)} not listed
        </p>
      )}
      <p
        className={cn(
          'flex items-baseline gap-3 px-3 py-2 text-caption text-fg-muted',
          shown.length > 0 && 'border-t border-line-faint',
        )}
      >
        <span className="min-w-0 flex-1">{getWorktreeChangesLabel(changes)}</span>
        {changes.added + changes.removed > 0 && (
          <LineCounts added={changes.added} removed={changes.removed} />
        )}
      </p>
    </div>
  );
}

interface CopyCommandButtonProps {
  label: string;
  command: string;
}

function CopyCommandButton({ label, command }: CopyCommandButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => setIsCopied(false), COPIED_MS);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setHasFailed(false);
      setIsCopied(true);
    } catch {
      setHasFailed(true);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="small"
        className="max-sm:h-9"
        title={command}
        onClick={() => void copy()}
      >
        {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {label}
      </Button>
      <span role="status" className="sr-only">
        {isCopied ? 'Copied' : ''}
      </span>
      {hasFailed && (
        <p role="alert" className="basis-full text-body-sm text-negative">
          Couldn&rsquo;t copy. Copy it yourself:{' '}
          <code className="font-mono wrap-anywhere select-all">{command}</code>
        </p>
      )}
    </>
  );
}

interface WorktreeCardProps {
  run: RunRecord;
  worktree: RunWorktree;
}

export function WorktreeCard({ run, worktree }: WorktreeCardProps) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => removeRunWorktree(sameOriginApi, run.routine, run.id),
    onSuccess: () =>
      Promise.all(
        QUERY_KEYS_CHANGED_BY_WORKTREE.map(queryKey => queryClient.invalidateQueries({ queryKey })),
      ),
  });
  // isPending updates after a render, so a double click would send the request twice.
  const isRemovingRef = useRef(false);
  const isActive = checkIsRunActive(run);
  const { state, changes } = worktree;
  const isPresent = isMatching('present', state);
  const isRemoved = isMatching('removed', state);
  const isDiscarded = isMatching('discarded', state);

  function remove() {
    if (isRemovingRef.current) return;
    isRemovingRef.current = true;
    mutate(undefined, {
      onSettled: () => {
        isRemovingRef.current = false;
      },
    });
  }

  return (
    <section
      aria-labelledby={titleId}
      className="mb-6 rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <h2 id={titleId} className="flex items-start gap-2 text-body font-medium text-fg">
        <FolderGit2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
        {isActive ? 'Working in its own worktree' : 'Ran in its own worktree'}
      </h2>
      <p className="mt-1 text-body-sm text-fg-muted sm:pl-6">
        Your checkout in{' '}
        <code className="font-mono wrap-anywhere text-fg-secondary">{worktree.checkout}</code>{' '}
        {isActive
          ? 'stays as it is. The agent works on its own branch:'
          : 'stayed as it was. The agent worked on its own branch:'}
      </p>
      <div className="mt-3 flex items-start gap-2 sm:pl-6">
        <GitBranch aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
        <div className="min-w-0">
          <p className="font-mono text-body-sm wrap-anywhere text-fg">
            {worktree.branch}
            <span className="font-sans text-fg-muted"> from {worktree.base}</span>
          </p>
          <p
            className={cn(
              'mt-0.5 text-caption wrap-anywhere text-fg-muted',
              isPresent && 'font-mono',
            )}
          >
            {match(state)
              .with('present', () => worktree.path)
              .with('removed', () => 'Worktree removed. The branch stays.')
              .with(
                'discarded',
                () => 'Nothing changed, so Kombinat removed the worktree and its branch.',
              )
              .exhaustive()}
          </p>
        </div>
      </div>
      {changes !== null && !isDiscarded && <ChangedFiles changes={changes} />}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:pl-6">
        {!isDiscarded && (
          <div className="flex flex-wrap items-center gap-2">
            {isPresent ? (
              <CopyCommandButton
                key="cd"
                label="Copy cd"
                command={`cd ${quoteForShell(worktree.cwd)}`}
              />
            ) : (
              <CopyCommandButton
                key="git-switch"
                label="Copy git switch"
                command={`git switch ${worktree.branch}`}
              />
            )}
            {!isActive && (
              <Button
                variant="tertiary"
                size="small"
                className="max-sm:h-9"
                disabled={isRemoved}
                aria-disabled={isPending || undefined}
                onClick={remove}
              >
                {isPending ? (
                  <Loader aria-hidden="true" className="spin-in-place" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                {match({ isPending, isRemoved })
                  .with({ isPending: true }, () => 'Removing…')
                  .with({ isRemoved: true }, () => 'Worktree removed')
                  .otherwise(() => 'Remove worktree')}
              </Button>
            )}
          </div>
        )}
        <p className="text-caption text-fg-muted">
          <code className="font-mono text-fg-secondary">worktree: true</code> in the routine
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 animate-in text-body-sm text-negative duration-200 fade-in sm:pl-6"
        >
          {error.message}
        </p>
      )}
    </section>
  );
}
