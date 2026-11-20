import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { GITHUB_RELEASES_PATH } from 'domains/release/constants';
import { getChangelog } from 'domains/release/requests';
import { createHttpClient } from 'utils/http';
import { useDocumentTitle } from 'web-app/hooks/use-document-title';
import { RELEASES_URL } from '../../constants';
import { ReleaseEntry } from './release-entry';

const github = createHttpClient({ baseUrl: 'https://api.github.com', timeoutMs: 10_000 });

// Each release renders its markdown, so a long history opens a page at a time to stay quick on phones.
const PAGE_SIZE = 10;

export function ChangelogPage() {
  useDocumentTitle('Changelog');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { data, isError, isPending } = useQuery({
    queryKey: [GITHUB_RELEASES_PATH],
    queryFn: () => getChangelog(github),
    staleTime: Infinity,
  });

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
          <>
            <ol className="divide-y divide-line-faint">
              {data.slice(0, visibleCount).map((release, index) => (
                <li key={release.version}>
                  <ReleaseEntry release={release} isLatest={index === 0} />
                </li>
              ))}
            </ol>
            {data.length > visibleCount && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="secondary"
                  className="relative max-sm:after:absolute max-sm:after:-inset-2"
                  onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                >
                  Show older releases
                </Button>
              </div>
            )}
          </>
        ))}
    </div>
  );
}
