import { Route, Routes } from 'react-router';
import {
  CALENDAR_PATH,
  INBOX_PATH,
  INSIGHTS_PATH,
  NEW_RUN_PATH,
  ROUTINES_PATH,
  ROUTINE_PATH,
  ROUTINE_RUN_PATH,
  RUNS_PATH,
  RUN_PATH,
  TEMPLATES_PATH,
  TEMPLATE_PATH,
} from '@web-app/constants/path';
import { useCustomization } from '@web-app/contexts';
import { CalendarPage } from '@web-app/features/calendar/calendar-page';
import { InboxPage } from '@web-app/features/inbox/inbox-page';
import { InsightsPage } from '@web-app/features/insights/insights-page';
import { NotFoundPage } from '@web-app/features/not-found/not-found-page';
import { ChangePromptPage } from '@web-app/features/routines/change-prompt-page';
import { RoutinePage } from '@web-app/features/routines/routine-page';
import { RoutinesPage } from '@web-app/features/routines/routines-page';
import { NewRunPage } from '@web-app/features/runs/new-run-page';
import { RunPage } from '@web-app/features/runs/run-page';
import { RunsPage } from '@web-app/features/runs/runs-page';
import { TemplatePage } from '@web-app/features/templates/template-page';
import { TemplatesPage } from '@web-app/features/templates/templates-page';

export function AppRoutes() {
  const { routes = [] } = useCustomization();
  return (
    <Routes>
      <Route path={ROUTINES_PATH} element={<RoutinesPage />} />
      <Route path={CALENDAR_PATH} element={<CalendarPage />} />
      <Route path={RUNS_PATH} element={<RunsPage />} />
      <Route path={NEW_RUN_PATH} element={<NewRunPage />} />
      <Route path={INBOX_PATH} element={<InboxPage />} />
      <Route path={INSIGHTS_PATH} element={<InsightsPage />} />
      <Route path={ROUTINE_PATH} element={<RoutinePage />} />
      <Route path={ROUTINE_RUN_PATH} element={<ChangePromptPage />} />
      <Route path={TEMPLATES_PATH} element={<TemplatesPage />} />
      <Route path={TEMPLATE_PATH} element={<TemplatePage />} />
      <Route path={RUN_PATH} element={<RunPage />} />
      {routes.map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
