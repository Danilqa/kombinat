import { PageHeader } from 'design-system';
import { WeekCalendar } from '@web-app/domains/calendar/components';
import { useDocumentTitle } from '@web-app/hooks';

export function CalendarPage() {
  useDocumentTitle('Calendar');
  return (
    <div>
      <PageHeader.Root title="Calendar" />
      <WeekCalendar />
    </div>
  );
}
