import { Inbox } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from 'design-system/components';
import { cn } from 'design-system/utils';
import { INBOX_PATH } from '@web-app/constants/path';
import { UnreadBadge } from '@web-app/components/unread-badge';

interface InboxIconLinkProps {
  pathname: string;
  unreadCount: number;
  className?: string;
}

export function InboxIconLink({ pathname, unreadCount, className }: InboxIconLinkProps) {
  const isActive = pathname.startsWith(INBOX_PATH);
  return (
    <Button
      asChild
      variant="tertiary"
      size="small"
      isActive={isActive}
      className={cn('relative mr-2 size-8 px-0', className)}
    >
      <Link to={INBOX_PATH} aria-current={isActive ? 'page' : undefined}>
        <Inbox aria-hidden="true" />
        <span className="sr-only">Inbox</span>
        {unreadCount > 0 && (
          <UnreadBadge count={unreadCount} max={99} className="absolute -top-1 left-4" />
        )}
      </Link>
    </Button>
  );
}
