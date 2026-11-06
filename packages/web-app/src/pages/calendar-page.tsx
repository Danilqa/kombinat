import { PageHeader } from '@web-app/components/page-header';
import { WeekCalendar } from '@web-app/components/week-calendar';
import { useDocumentTitle } from '@web-app/lib/use-document-title';

export function CalendarPage() {
  useDocumentTitle('Calendar');
  return (
    <div>
      <PageHeader title="Calendar" />
      <WeekCalendar />
    </div>
  );
}
