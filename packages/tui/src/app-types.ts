import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunRecord } from 'domains/run/types';
import type { RunLaterPreset } from 'domains/scheduler/types';
import type { Settings } from 'domains/settings/types';
import type { TranscriptItem } from 'domains/transcript/types';

import type { PageContent } from './page-content';
import type { RoutineTab } from './pages/routine-page';
import type { RenderedTranscript } from './pages/run-page';

export type ListFocus = 'routines' | 'runs';
export type Focus = ListFocus | 'detail';

// What the cursor was on at the last render, so it moves along when new lines show up above it.
export interface Anchor {
  cursor: number;
  key: string;
  offset: number;
}

export interface RoutinePage {
  kind: 'routine';
  name: RoutineName;
  tab: RoutineTab;
  cursor: number;
  scroll: number;
  anchor: Anchor | null;
}

export interface RunPage {
  kind: 'run';
  routine: RoutineName;
  id: RunId;
  cursor: number;
  scroll: number;
  anchor: Anchor | null;
  // Keeps the cursor on the last line while a run is still writing events.
  follow: boolean;
}

export type Page = RoutinePage | RunPage;

interface HelpOverlay {
  kind: 'help';
}

interface ConfirmRunOverlay {
  kind: 'confirm-run';
  routine: RoutineName;
}

interface SettingsOverlay {
  kind: 'settings';
  settings: Settings;
}

interface RunLaterOverlay {
  kind: 'run-later';
  routine: RoutineName;
  presets: RunLaterPreset[];
}

export type Overlay = HelpOverlay | ConfirmRunOverlay | RunLaterOverlay | SettingsOverlay;

export interface Message {
  text: string;
  tone: 'ok' | 'error';
  at: number;
}

export interface RunData {
  run: RunRecord;
  eventCount: number;
  items: TranscriptItem[];
  expanded: Set<string>;
  expandedVersion: number;
  transcript: RenderedTranscript | null;
}

export interface Viewport {
  content: PageContent;
  height: number;
  width: number;
}
