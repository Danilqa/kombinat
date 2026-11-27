import { useId } from 'react';
import { Badge, Markdown } from 'design-system';
import type { ChangelogRelease } from 'domains/release/types';
import { formatDate } from 'utils/date-time';
import { ReleaseImages } from '../release-images';

interface ReleaseEntryProps {
  release: ChangelogRelease;
  isLatest: boolean;
}

export function ReleaseEntry({ release, isLatest }: ReleaseEntryProps) {
  const titleId = useId();
  const { version, notes, images, publishedAt } = release;
  return (
    <article
      aria-labelledby={titleId}
      className="grid gap-x-10 gap-y-3 py-8 lg:grid-cols-[10rem_minmax(0,1fr)]"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 self-start lg:sticky lg:top-below-page-header lg:flex-col lg:items-start">
        <div className="flex items-center gap-2">
          <h2 id={titleId} className="text-title-md text-fg tabular-nums">
            {version}
          </h2>
          {isLatest && (
            <Badge variant="positive" size="small">
              Latest
            </Badge>
          )}
        </div>
        <time dateTime={publishedAt} className="text-body-sm text-fg-muted tabular-nums">
          {formatDate(publishedAt)}
        </time>
      </header>
      <div className="flex max-w-2xl min-w-0 flex-col gap-4">
        {notes && <Markdown source={notes} minHeadingLevel={3} className="prose-ul:my-0" />}
        {images.length > 0 && <ReleaseImages images={images} />}
      </div>
    </article>
  );
}
