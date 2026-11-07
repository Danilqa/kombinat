import { PageHeader } from 'design-system/layouts';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { WeekCalendar } from './week-calendar';

export function CalendarPage() {
  useDocumentTitle('Calendar');
  return (
    <div>
      <PageHeader.Root title="Calendar" />
      <WeekCalendar />
    </div>
  );
}
