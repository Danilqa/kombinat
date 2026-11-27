import { Route, Routes } from 'react-router';
import { useCustomization } from '@web-app/customization';
import { CalendarPage } from '@web-app/pages/calendar';
import { ChangePromptPage } from '@web-app/pages/change-prompt';
import { InboxPage } from '@web-app/pages/inbox';
import { InsightsPage } from '@web-app/pages/insights';
import { NewRunPage } from '@web-app/pages/new-run';
import { NotFoundPage } from '@web-app/pages/not-found';
import { RoutinePage } from '@web-app/pages/routine';
import { RoutinesPage } from '@web-app/pages/routines';
import { RunPage } from '@web-app/pages/run';
import { RunsPage } from '@web-app/pages/runs';
import { TemplatePage } from '@web-app/pages/template';
import { TemplatesPage } from '@web-app/pages/templates';
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
} from '@web-app/paths';

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
