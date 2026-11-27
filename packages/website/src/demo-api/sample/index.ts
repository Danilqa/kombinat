import { nightAgentTasks } from './routines/night-agent-tasks';
import { designUxIssues } from './routines/design-ux-issues';
import { postReleaseMonitoring } from './routines/post-release-monitoring';
import { onCallEngineer } from './routines/on-call-engineer';
import { writeReleaseNotes } from './routines/write-release-notes';
import { flakyE2eFixer } from './routines/flaky-e2e-fixer';
import { bugFixPickup } from './routines/bug-fix-pickup';
import { prReviewSweep } from './routines/pr-review-sweep';
import { deadCodeCleanup } from './routines/dead-code-cleanup';
import { supportSignals } from './routines/support-signals';
import { notesBackup } from './routines/notes-backup';
import { umbrellaCheck } from './routines/umbrella-check';
import type { DemoRoutine } from './types';

export const demoRoutines: DemoRoutine[] = [
  nightAgentTasks,
  designUxIssues,
  postReleaseMonitoring,
  onCallEngineer,
  writeReleaseNotes,
  flakyE2eFixer,
  bugFixPickup,
  prReviewSweep,
  deadCodeCleanup,
  supportSignals,
  notesBackup,
  umbrellaCheck,
];
