import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from 'design-system/components';

function getMatchCountLabel(matchCount: number, current: number): string {
  return matchCount === 0 ? 'No matches' : `${current + 1} of ${matchCount}`;
}

interface TranscriptSearchProps {
  value: string;
  // null while the search is still being typed, so it never shows the count of an older one.
  matchCount: number | null;
  current: number;
  onValueChange: (value: string) => void;
  onMove: (step: 1 | -1) => void;
  onClose: () => void;
}

export function TranscriptSearch({
  value,
  matchCount,
  current,
  onValueChange,
  onMove,
  onClose,
}: TranscriptSearchProps) {
  const id = useId();
  const hasSearch = value.trim() !== '';
  const canMove = matchCount !== null && matchCount > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onMove(event.shiftKey ? -1 : 1);
    }
    if (event.key === 'Escape') onClose();
  }

  return (
    <div
      role="search"
      className="flex h-9 w-full items-center gap-1 rounded-full border border-line bg-surface pr-1 pl-3 transition-colors focus-within:border-line-strong max-sm:h-11 sm:w-80"
    >
      <Search aria-hidden="true" className="size-3.5 shrink-0 text-fg-muted" />
      <label htmlFor={id} className="sr-only">
        Search the transcript
      </label>
      <input
        id={id}
        value={value}
        autoFocus
        placeholder="Search the transcript"
        autoComplete="off"
        spellCheck={false}
        onChange={event => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-body text-fg outline-none placeholder:text-fg-muted focus-visible:shadow-none"
      />
      {hasSearch && (
        <>
          <span role="status" className="shrink-0 px-1 text-body-sm text-fg-muted tabular-nums">
            {matchCount !== null && getMatchCountLabel(matchCount, current)}
          </span>
          <Button
            variant="tertiary"
            size="icon-small"
            className="max-sm:size-9"
            aria-disabled={!canMove || undefined}
            onClick={() => onMove(-1)}
          >
            <ChevronUp aria-hidden="true" className="size-4" />
            <span className="sr-only">Previous match</span>
          </Button>
          <Button
            variant="tertiary"
            size="icon-small"
            className="max-sm:size-9"
            aria-disabled={!canMove || undefined}
            onClick={() => onMove(1)}
          >
            <ChevronDown aria-hidden="true" className="size-4" />
            <span className="sr-only">Next match</span>
          </Button>
        </>
      )}
      <Button variant="tertiary" size="icon-small" className="max-sm:size-9" onClick={onClose}>
        <X aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Close search</span>
      </Button>
    </div>
  );
}
