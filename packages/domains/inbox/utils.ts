import { match } from 'ts-pattern';

import type { RunRecord } from '../run/types';
import { checkIsRunActive } from '../run/utils';
import { INBOX_GROUPS } from './constants';
import type { InboxGroup, InboxRunKey, InboxSection, InboxState } from './types';

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
    .with('running', 'failed', 'timed_out', 'aborted', (): InboxGroup => 'needs_look')
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
