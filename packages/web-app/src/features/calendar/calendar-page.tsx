import { PageHeader } from 'design-system/layouts/page-header';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { WeekCalendar } from './week-calendar';

export function CalendarPage() {
  useDocumentTitle('Calendar');
  return (
    <div>
      <PageHeader title="Calendar" />
      <WeekCalendar />
    </div>
  );
}
