import { Route, Routes } from 'react-router';
import { useCustomization } from '@web-app/customization';
import {
  CalendarPage,
  ChangePromptPage,
  InboxPage,
  InsightsPage,
  NewRunPage,
  NotFoundPage,
  RoutinePage,
  RoutinesPage,
  RunPage,
  RunsPage,
  TemplatePage,
  TemplatesPage,
} from '@web-app/pages';
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
