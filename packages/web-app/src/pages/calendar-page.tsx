import { PageHeader } from '@/components/page-header';
import { WeekCalendar } from '@/components/week-calendar';
import { useDocumentTitle } from '@/lib/use-document-title';

export function CalendarPage() {
  useDocumentTitle('Calendar');
  return (
    <div>
      <PageHeader title="Calendar" />
      <WeekCalendar />
    </div>
  );
}
