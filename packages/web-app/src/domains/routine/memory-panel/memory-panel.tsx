import {
  useDeferredValue,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from 'react';
import { Eraser, Loader, Pencil, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, EmptyState, Markdown, RelativeTime } from 'design-system';
import { MEMORY_MAX_LENGTH } from 'domains/routine/constants';
import type { RoutineName } from 'domains/routine/ids';
import type { RoutineMemory } from 'domains/routine/types';
import { getMemoryAuthorLabel, getMemoryChangeVerb } from 'domains/routine/utils';
import type { RunId } from 'domains/run/ids';
import { getRunPath } from '@web-app/paths';
import { PromptEditor } from '../prompt-editor';
import { useSaveRoutineMemory } from '../queries';

const FORM_ID = 'memory-notes';

interface MemoryChangeLineProps {
  routine: RoutineName;
  memory: RoutineMemory;
  lastRunId: RunId | null;
}

function MemoryChangeLine({ routine, memory, lastRunId }: MemoryChangeLineProps) {
  const { change } = memory;
  if (change === null) return null;
  const author = getMemoryAuthorLabel(change, lastRunId);
  const hasCounts = change.added !== null && change.removed !== null && memory.text !== '';
  return (
    <span className="min-w-0">
      {getMemoryChangeVerb(memory)} by{' '}
      {change.runId === null ? (
        <span className="text-fg-secondary">{author}</span>
      ) : (
        <Link
          to={getRunPath(routine, change.runId)}
          className="text-fg-secondary underline-offset-4 hover:text-fg hover:underline"
        >
          {author}
        </Link>
      )}{' '}
      <RelativeTime iso={change.at} isFocusable />
      {hasCounts && (
        <span className="tabular-nums">
          {' · '}
          <span className="text-positive">+{change.added}</span>{' '}
          <span className="text-negative">−{change.removed}</span> lines
        </span>
      )}
    </span>
  );
}

interface MemoryPanelProps {
  routine: RoutineName;
  memory: RoutineMemory;
  lastRunId: RunId | null;
  isRunning: boolean;
}

export function MemoryPanel({ routine, memory, lastRunId, isRunning }: MemoryPanelProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [clearedText, setClearedText] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const notesField = useRef<HTMLTextAreaElement>(null);
  const save = useSaveRoutineMemory(routine);
  const isEmpty = memory.text === '';
  // Long notes take a moment to render, which happens after the page shows.
  const shownText = useDeferredValue(memory.text, '');
  const isEditing = draft !== null;
  const isTooLong = draft !== null && draft.length > MEMORY_MAX_LENGTH;

  // New notes go at the end, so the caret starts there.
  useLayoutEffect(() => {
    const field = notesField.current;
    if (isEditing && field !== null)
      field.setSelectionRange(field.value.length, field.value.length);
  }, [isEditing]);

  function saveText(text: string, onSaved: () => void) {
    if (save.isPending) return;
    save.mutate(text, { onSuccess: onSaved });
  }

  function startEditing() {
    save.reset();
    setClearedText(null);
    setDraft(memory.text);
  }

  // The buttons that had the focus unmount, so it moves to the one that takes their place.
  function stopEditing() {
    setDraft(null);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (draft !== null && !isTooLong) saveText(draft, stopEditing);
  }

  function cancelOnEscape(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && draft === memory.text) stopEditing();
  }

  function clear() {
    const text = memory.text;
    saveText('', () => {
      setClearedText(text);
      requestAnimationFrame(() => undoButton.current?.focus());
    });
  }

  function undo() {
    if (clearedText === null) return;
    saveText(clearedText, () => {
      setClearedText(null);
      requestAnimationFrame(() => editButton.current?.focus());
    });
  }

  const error = save.error && (
    <span role="alert" className="min-w-0 wrap-break-word text-negative">
      {save.error.message}
    </span>
  );

  if (draft !== null) {
    return (
      <form id={FORM_ID} onSubmit={submit} onKeyDown={cancelOnEscape} className="space-y-3">
        <PromptEditor
          ref={notesField}
          value={draft}
          onChange={setDraft}
          label="Notes"
          submitLabel="save"
          placeholder="What should the next run know? Such as what to skip or where to start."
          autoFocus
          header={
            <>
              <span className="min-w-48 flex-1">
                {error ?? (
                  <MemoryChangeLine routine={routine} memory={memory} lastRunId={lastRunId} />
                )}
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="tertiary"
                  size="small"
                  className="max-sm:h-9"
                  onClick={stopEditing}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  size="small"
                  className="max-sm:h-9"
                  aria-disabled={save.isPending || isTooLong || undefined}
                >
                  {save.isPending && (
                    <Loader aria-hidden="true" className="size-3.5 spin-in-place" />
                  )}
                  Save
                </Button>
              </div>
            </>
          }
          footer={
            <span className="min-w-0 truncate">
              {isRunning ? "A run is at work. It won't change notes you save now." : memory.file}
            </span>
          }
        />
        {isTooLong && (
          <p role="alert" className="px-1 text-body-sm text-negative">
            Notes can be up to {MEMORY_MAX_LENGTH.toLocaleString('en')} characters. Shorten them to
            save.
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <Card.Root>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-6 py-2.5 text-body-sm text-fg-muted">
          <span className="min-w-48 flex-1">
            {error ?? <MemoryChangeLine routine={routine} memory={memory} lastRunId={lastRunId} />}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              ref={editButton}
              variant="tertiary"
              size="small"
              className="max-sm:h-9"
              onClick={startEditing}
            >
              <Pencil aria-hidden="true" />
              {isEmpty ? 'Write notes' : 'Edit'}
            </Button>
            {clearedText !== null && isEmpty ? (
              <Button
                ref={undoButton}
                variant="tertiary"
                size="small"
                className="max-sm:h-9"
                aria-disabled={save.isPending || undefined}
                onClick={undo}
              >
                <Undo2 aria-hidden="true" />
                Undo
              </Button>
            ) : (
              !isEmpty && (
                <Button
                  variant="tertiary"
                  size="small"
                  className="max-sm:h-9"
                  aria-disabled={save.isPending || undefined}
                  onClick={clear}
                >
                  <Eraser aria-hidden="true" />
                  Clear
                </Button>
              )
            )}
          </div>
        </div>
        {isEmpty ? (
          <EmptyState>No notes yet. The next run starts them.</EmptyState>
        ) : (
          <div className="p-6">
            <Markdown source={shownText} minHeadingLevel={3} />
          </div>
        )}
      </Card.Root>
      <p className="px-1 text-body-sm text-fg-muted">
        The agent reads these notes before each run and updates them at the end. They stay on this
        machine, in <code className="font-mono break-all">{memory.file}</code>, not in git.
      </p>
    </div>
  );
}
