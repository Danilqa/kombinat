import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';

import type { Line } from './terminal/text';

export interface OpenRunAction {
  kind: 'open-run';
  routine: RoutineName;
  id: RunId;
}

export interface ToggleAction {
  kind: 'toggle';
  key: string;
}

export type Action = OpenRunAction | ToggleAction;

export interface ContentLine {
  line: Line;
  action?: Action;
  itemKey?: string;
  isItemStart?: boolean;
}

// select: the cursor jumps between lines with an action. scroll: no cursor. line: the cursor moves line by line.
export type CursorMode = 'select' | 'scroll' | 'line';

export interface PageContent {
  lines: ContentLine[];
  mode: CursorMode;
}

export const blank = (): ContentLine => ({ line: [] });
export const toContent = (lines: Line[]): ContentLine[] => lines.map(line => ({ line }));
