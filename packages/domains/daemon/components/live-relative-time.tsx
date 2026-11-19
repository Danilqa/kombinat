import { useLiveText } from 'design-system/utils';
import { formatRelative } from 'utils/date-time';

interface LiveRelativeTimeProps {
  iso: string;
}

export function LiveRelativeTime({ iso }: LiveRelativeTimeProps) {
  const relative = useLiveText(now => formatRelative(iso, now));
  return <time dateTime={iso}>{relative}</time>;
}
