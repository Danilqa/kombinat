import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, Copy, X } from 'lucide-react';
import { useEffect, useId, useState, type AnimationEvent } from 'react';

import { Button, Markdown } from 'design-system/components';
import { checkPrefersReducedMotion, cn } from 'design-system/utils';
import { formatDayMonth } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';

import type { ReleaseVersion } from '../ids';
import { getReleaseUpdate, skipRelease } from '../requests';
import type { ReleaseUpdate } from '../types';
import { getOfferedRelease } from '../utils';

const POLL_MS = 5 * 60_000;
const COPIED_MS = 1500;
const QUERY_KEY = ['releases'];

interface UpdateCommandProps {
  command: string;
}

function UpdateCommand({ command }: UpdateCommandProps) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => setIsCopied(false), COPIED_MS);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setIsCopied(true);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line-faint bg-surface py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 font-mono text-body-sm wrap-break-word text-fg-prose">
        {command}
      </code>
      <Button
        variant="tertiary"
        size="icon-small"
        aria-label={isCopied ? 'Copied' : 'Copy the command'}
        onClick={() => void copy()}
      >
        {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </div>
  );
}

// Closing the card skips its version, so it comes back only for a newer release.
// It is sticky rather than fixed, so it takes room at the end of the page and every row can scroll clear of it.
export function UpdateCard() {
  const titleId = useId();
  const queryClient = useQueryClient();
  const [isClosing, setIsClosing] = useState(false);
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getReleaseUpdate(sameOriginApi),
    refetchInterval: POLL_MS,
  });
  const { mutate } = useMutation({
    mutationFn: (version: ReleaseVersion) => skipRelease(sameOriginApi, version),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  const offered = data === undefined ? null : getOfferedRelease(data);
  if (data === undefined || offered === null) return null;

  const { version } = offered;

  function skip() {
    queryClient.setQueryData<ReleaseUpdate>(
      QUERY_KEY,
      current => current && { ...current, skippedVersion: version },
    );
    setIsClosing(false);
    mutate(version);
  }

  function close() {
    if (checkPrefersReducedMotion()) skip();
    else setIsClosing(true);
  }

  function finishClosing(event: AnimationEvent<HTMLElement>) {
    if (isClosing && event.target === event.currentTarget) skip();
  }

  return (
    <aside
      aria-labelledby={titleId}
      inert={isClosing}
      onAnimationEnd={finishClosing}
      className={cn(
        'sticky bottom-[calc(--spacing(4)+env(safe-area-inset-bottom))] z-40 mx-4 mb-4 flex max-h-[min(30rem,calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] max-w-104 flex-col rounded-xl border border-line bg-raised text-body-sm text-fg shadow-popover ease-out-quint',
        isClosing
          ? 'animate-out duration-150 fade-out-0 slide-out-to-bottom-2'
          : 'animate-in duration-300 fade-in-0 slide-in-from-bottom-2',
      )}
    >
      <header className="flex items-start gap-3 py-3 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-body font-medium">
            Kombinat {version} is available
          </h2>
          <p className="text-fg-muted">You have {data.installedVersion}</p>
        </div>
        <Button
          variant="tertiary"
          size="icon-small"
          aria-label={`Skip version ${version}`}
          title="Skip this version"
          onClick={close}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </header>
      <div
        tabIndex={0}
        role="region"
        aria-label="Changelog"
        className="flex min-h-0 flex-col gap-4 overflow-y-auto border-y border-line-faint px-4 py-3"
      >
        {data.releases.map(release => (
          <section key={release.version}>
            <h3 className="flex items-baseline justify-between text-caption text-fg-muted">
              <span className="font-medium text-fg-secondary">{release.version}</span>
              <time dateTime={release.publishedAt}>
                {formatDayMonth(new Date(release.publishedAt))}
              </time>
            </h3>
            {release.notes && (
              <Markdown
                source={release.notes}
                minHeadingLevel={3}
                className="text-body-sm prose-ul:my-1 prose-ul:pl-4"
              />
            )}
          </section>
        ))}
      </div>
      <footer className="flex flex-col gap-2 px-4 py-3">
        {data.updateCommand !== null && (
          <>
            <p className="text-fg-muted">Run it in your routines folder to update:</p>
            <UpdateCommand command={data.updateCommand} />
          </>
        )}
        <a
          href={offered.url}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex w-fit items-center gap-0.5 text-fg-muted transition-colors hover:text-fg"
        >
          Release notes on GitHub
          <ArrowUpRight
            aria-hidden="true"
            className="size-3 transition-transform duration-200 ease-out-quint group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
      </footer>
    </aside>
  );
}
