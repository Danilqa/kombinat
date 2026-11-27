import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorState, LoadingState, PageHeader } from 'design-system';
import { useDocumentTitle } from 'web-app/hooks';
import { RELEASES_URL } from '../constants';
import { useChangelog } from '../domains/release/queries';
import { ReleaseEntry } from '../domains/release/components';

// Each release renders its markdown, so a long history opens a page at a time to stay quick on phones.
const PAGE_SIZE = 10;

export function ChangelogPage() {
  useDocumentTitle('Changelog');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const lastReleaseRef = useRef<HTMLLIElement>(null);
  const { data, isError, isPending } = useChangelog();
  const hasOlderReleases = data !== undefined && data.length > visibleCount;

  // A new observer reports at once, so a page shorter than the screen keeps filling it.
  useEffect(() => {
    const lastRelease = lastReleaseRef.current;
    if (!hasOlderReleases || lastRelease === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setVisibleCount(count => count + PAGE_SIZE);
      },
      { rootMargin: '0px 0px 100% 0px' },
    );
    observer.observe(lastRelease);
    return () => observer.disconnect();
  }, [hasOlderReleases, visibleCount]);

  return (
    <div>
      <PageHeader.Root
        title="Changelog"
        aside={
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-0.5 text-body-sm text-fg-muted transition-colors hover:text-fg"
          >
            Release notes on GitHub
            <ArrowUpRight
              aria-hidden="true"
              className="size-3 transition-transform duration-200 ease-out-quint group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        }
      />
      {isError && (
        <ErrorState message="Can't load the changelog from GitHub. Reload the page or read the release notes there." />
      )}
      {isPending && <LoadingState />}
      {data &&
        (data.length === 0 ? (
          <EmptyState>No releases yet.</EmptyState>
        ) : (
          <ol className="divide-y divide-line-faint">
            {data.slice(0, visibleCount).map((release, index) => (
              <li
                key={release.version}
                ref={index === visibleCount - 1 ? lastReleaseRef : undefined}
              >
                <ReleaseEntry release={release} isLatest={index === 0} />
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}
