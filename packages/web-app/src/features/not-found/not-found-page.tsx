import { Link } from 'react-router';
import { PageTitle } from 'design-system/layouts/page-header';
import { ROUTINES_PATH } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center">
      <PageTitle>Page not found</PageTitle>
      <p className="text-body text-fg-muted">
        This page does not exist.{' '}
        <Link
          to={ROUTINES_PATH}
          className="font-medium text-fg-secondary underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          Back to routines
        </Link>
      </p>
    </div>
  );
}
