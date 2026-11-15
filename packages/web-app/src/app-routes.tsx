import { Route, Routes } from 'react-router';
import {
  CALENDAR_PATH,
  ROUTINES_PATH,
  ROUTINE_PATH,
  RUNS_PATH,
  RUN_PATH,
} from '@web-app/constants/path';
import { CalendarPage } from '@web-app/features/calendar/calendar-page';
import { NotFoundPage } from '@web-app/features/not-found/not-found-page';
import { RoutinePage } from '@web-app/features/routines/routine-page';
import { RoutinesPage } from '@web-app/features/routines/routines-page';
import { RunPage } from '@web-app/features/runs/run-page';
import { RunsPage } from '@web-app/features/runs/runs-page';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTINES_PATH} element={<RoutinesPage />} />
      <Route path={CALENDAR_PATH} element={<CalendarPage />} />
      <Route path={RUNS_PATH} element={<RunsPage />} />
      <Route path={ROUTINE_PATH} element={<RoutinePage />} />
      <Route path={RUN_PATH} element={<RunPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
