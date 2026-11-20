import { isMatching, match } from 'ts-pattern';

import type { RoutineName } from '../routine/ids';
import type { RunRecord } from '../run/types';
import { checkIsRunActive, getRunStatusLabel } from '../run/utils';
import { DEFAULT_NOTIFY_LEVEL, INBOX_GROUPS, MAX_RUN_NOTIFICATIONS } from './constants';
import { notifyLevelsSchema } from './schemas';
import type {
  Inbox,
  InboxGroup,
  InboxRunKey,
  InboxSection,
  InboxState,
  NotifyLevel,
  NotifyLevels,
  RunNotification,
} from './types';

const NOTHING_TO_REPORT = /^[\s#*_>`-]*(no|nothing)\b/i;

function getRunEndTime(run: Pick<RunRecord, 'startedAt' | 'endedAt'>): number {
  return Date.parse(run.endedAt ?? run.startedAt);
}

const toReadKey = ({ routine, id }: InboxRunKey) => `${routine}/${id}`;

export function toInboxRunKey({ routine, id }: InboxRunKey): InboxRunKey {
  return { routine, id };
}

export function listUnreadRuns(runs: RunRecord[], state: InboxState): RunRecord[] {
  const since = Date.parse(state.since);
  const readKeys = new Set(state.readRuns.map(toReadKey));
  return runs
    .filter(
      run => !checkIsRunActive(run) && getRunEndTime(run) > since && !readKeys.has(toReadKey(run)),
    )
    .sort((a, b) => getRunEndTime(b) - getRunEndTime(a));
}

// Keeps only the keys that still mark a run read, so the file shrinks as runs are deleted.
export function addReadRuns(state: InboxState, keys: InboxRunKey[], runs: RunRecord[]): InboxState {
  const since = Date.parse(state.since);
  const readKeys = new Set([...state.readRuns, ...keys].map(toReadKey));
  return {
    since: state.since,
    readRuns: runs
      .filter(run => getRunEndTime(run) > since && readKeys.has(toReadKey(run)))
      .map(toInboxRunKey),
  };
}

// Agents that found nothing tend to say so first, such as "No open incidents.".
export function checkHasNothingToReport(resultText: string | null): boolean {
  return resultText === null || resultText.trim() === '' || NOTHING_TO_REPORT.test(resultText);
}

export function getInboxGroup(run: Pick<RunRecord, 'status' | 'resultText'>): InboxGroup {
  return match(run.status)
    .with('succeeded', (): InboxGroup =>
      checkHasNothingToReport(run.resultText) ? 'quiet' : 'findings',
    )
    .with('running', 'waiting', 'failed', 'timed_out', 'aborted', (): InboxGroup => 'needs_look')
    .exhaustive();
}

export function getInboxGroupLabel(group: InboxGroup): string {
  return match(group)
    .with('needs_look', () => 'Needs a look')
    .with('findings', () => 'Has findings')
    .with('quiet', () => 'Nothing to report')
    .exhaustive();
}

export function groupInboxRuns(runs: RunRecord[]): InboxSection[] {
  return INBOX_GROUPS.map(group => ({
    group,
    runs: runs.filter(run => getInboxGroup(run) === group),
  })).filter(section => section.runs.length > 0);
}

export function getInboxRunSummary(run: Pick<RunRecord, 'error' | 'resultText'>): string {
  const text = run.error ?? run.resultText ?? '';
  const line = text.split('\n').find(candidate => candidate.trim() !== '') ?? '';
  return line.replace(/^\s*#+\s*/, '').trim();
}

export function getNotifyLevelLabel(level: NotifyLevel): string {
  return match(level)
    .with('failures_and_findings', () => 'Failures and findings')
    .with('failures', () => 'Failures only')
    .with('every_run', () => 'Every run')
    .with('never', () => 'Never')
    .exhaustive();
}

export function getNotifyLevelShortLabel(level: NotifyLevel): string {
  return match(level)
    .with('failures_and_findings', () => 'Findings')
    .with('failures', () => 'Failures')
    .with('every_run', () => 'Every run')
    .with('never', () => 'Off')
    .exhaustive();
}

// A routine that never notifies is left out, so only the routines that notify are kept.
export function changeNotifyLevel(
  levels: NotifyLevels,
  routine: RoutineName,
  level: NotifyLevel,
): NotifyLevels {
  const others = Object.entries(levels).filter(([name]) => name !== routine);
  const kept = isMatching(DEFAULT_NOTIFY_LEVEL, level) ? others : [...others, [routine, level]];
  return notifyLevelsSchema.parse(Object.fromEntries(kept));
}

export function checkIsRunNotified(
  run: Pick<RunRecord, 'status' | 'resultText'>,
  level: NotifyLevel,
): boolean {
  const group = getInboxGroup(run);
  return match(level)
    .with('failures_and_findings', () => !isMatching('quiet', group))
    .with('failures', () => isMatching('needs_look', group))
    .with('every_run', () => true)
    .with('never', () => false)
    .exhaustive();
}

// Only runs that came into the inbox since the last look notify, so opening the dashboard is quiet.
export function listRunsToNotify(previousRuns: RunRecord[], inbox: Inbox): RunRecord[] {
  const previousKeys = new Set(previousRuns.map(toReadKey));
  return inbox.runs.filter(
    run =>
      !previousKeys.has(toReadKey(run)) &&
      checkIsRunNotified(run, inbox.notify[run.routine] ?? DEFAULT_NOTIFY_LEVEL),
  );
}

function getRunNotificationTitle(run: RunRecord): string {
  return match(getInboxGroup(run))
    .with('needs_look', () => `${run.routine} needs a look`)
    .with('findings', () => `${run.routine} has findings`)
    .with('quiet', () => `${run.routine} has nothing to report`)
    .exhaustive();
}

function getRunNotificationBody(run: RunRecord): string {
  const summary = getInboxRunSummary(run);
  const status = getRunStatusLabel(run.status);
  if (summary === '') return status;
  return match(getInboxGroup(run))
    .with('needs_look', () => `${status}: ${summary}`)
    .otherwise(() => summary);
}

function countRunsInGroup(count: number, group: InboxGroup): string {
  const isOne = count === 1;
  return match(group)
    .with('needs_look', () => `${count} ${isOne ? 'needs' : 'need'} a look`)
    .with('findings', () => `${count} ${isOne ? 'has' : 'have'} findings`)
    .with('quiet', () => `${count} ${isOne ? 'has' : 'have'} nothing to report`)
    .exhaustive();
}

export function buildRunNotifications(runs: RunRecord[]): RunNotification[] {
  if (runs.length <= MAX_RUN_NOTIFICATIONS) {
    return runs.map(run => ({
      title: getRunNotificationTitle(run),
      body: getRunNotificationBody(run),
      run,
    }));
  }
  const counts = groupInboxRuns(runs).map(({ group, runs: grouped }) =>
    countRunsInGroup(grouped.length, group),
  );
  return [{ title: `${runs.length} runs finished`, body: `${counts.join(', ')}.`, run: null }];
}
