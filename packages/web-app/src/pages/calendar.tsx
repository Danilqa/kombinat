import { PageHeader } from 'design-system';
import { WeekCalendar } from '@web-app/domains/calendar/week-calendar';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

export function CalendarPage() {
  useDocumentTitle('Calendar');
  return (
    <div>
      <PageHeader.Root title="Calendar" />
      <WeekCalendar />
    </div>
  );
}
