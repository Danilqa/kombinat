import { Star, X } from 'lucide-react';
import { useState, type TransitionEvent } from 'react';
import { cn } from 'design-system/utils';
import { useStoredBoolean } from 'web-app/hooks/use-stored-boolean';
import { REPO_URL } from '../constants';

const CLOSED_KEY = 'kombinat-website:star-bar-closed';

// The close button sits beside the link, not inside it, so the whole bar can be one link.
export function StarBar() {
  const [isClosed, setIsClosed] = useStoredBoolean(CLOSED_KEY, false);
  const [isClosing, setIsClosing] = useState(false);
  if (isClosed) return null;

  function finishClosing(event: TransitionEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && isClosing) setIsClosed(true);
  }

  return (
    <div
      inert={isClosing}
      onTransitionEnd={finishClosing}
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out-quint',
        isClosing ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
      )}
    >
      <div className="overflow-hidden">
        <div className="relative bg-linear-to-r from-[#b9a8ff] via-[#e3a7c9] to-[#f5b08a] text-page">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-9 items-center justify-center gap-1.5 px-11 py-2 text-center text-body-sm font-medium transition-[filter] hover:brightness-110"
          >
            <Star
              aria-hidden="true"
              className="size-3.5 shrink-0 fill-current transition-transform duration-500 ease-out-quint group-hover:scale-125 group-hover:rotate-72"
            />
            <span>
              <span className="max-sm:hidden">Support the project by giving it a star on </span>
              <span className="sm:hidden">Give it a star on </span>
              <span className="underline">GitHub</span>
            </span>
          </a>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setIsClosing(true)}
            className="group absolute top-1/2 right-2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-page/10"
          >
            <X
              aria-hidden="true"
              className="size-4 transition-transform duration-300 ease-out-quint group-hover:rotate-90"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
