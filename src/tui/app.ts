import { match, P } from 'ts-pattern';

import type { RunRecord } from '../state';
import type { TranscriptItem } from '../transcript';
import type { DaemonClient, Overview, RoutineDetail, RunWithTranscript } from './api';
import { formatRelative } from './format';
import { fitLine, S } from './text';
import type { Line } from './text';
import {
  box,
  confirmPopup,
  helpPopup,
  hintsBar,
  isExpandable,
  overlayOnto,
  routinePage,
  routineRow,
  runHeaderLines,
  runRow,
  statusLines,
  transcriptLines,
} from './views';
import type { ContentLine, PageContent, RoutineTab } from './views';

type ListFocus = 'routines' | 'runs';
type Focus = ListFocus | 'detail';

// What the cursor was on at the last render, so it moves along when new lines show up above it.
interface Anchor {
  cursor: number;
  key: string;
  offset: number;
}

interface RoutinePage {
  kind: 'routine';
  name: string;
  tab: RoutineTab;
  cursor: number;
  scroll: number;
  anchor: Anchor | null;
}

interface RunPage {
  kind: 'run';
  routine: string;
  id: string;
  cursor: number;
  scroll: number;
  anchor: Anchor | null;
  // Keeps the cursor on the last line while a run is still writing events.
  follow: boolean;
}

type Page = RoutinePage | RunPage;

interface HelpOverlay {
  kind: 'help';
}

interface ConfirmRunOverlay {
  kind: 'confirm-run';
  routine: string;
}

type Overlay = HelpOverlay | ConfirmRunOverlay;

interface Message {
  text: string;
  tone: 'ok' | 'error';
  at: number;
}

interface RenderedTranscript {
  key: string;
  lines: ContentLine[];
}

interface RunData {
  run: RunRecord;
  eventCount: number;
  items: TranscriptItem[];
  expanded: Set<string>;
  expandedVersion: number;
  transcript: RenderedTranscript | null;
}

interface Viewport {
  content: PageContent;
  height: number;
  width: number;
}

type Hint = [string, string];

const FOCUS_ORDER: Focus[] = ['routines', 'runs', 'detail'];
const TABS: RoutineTab[] = ['runs', 'prompt', 'skips'];
const MIN_WIDTH = 60;
const MIN_HEIGHT = 18;
const MESSAGE_MS = 6000;
const RUN_CACHE_SIZE = 4;

const runKey = (routine: string, id: string) => `${routine}/${id}`;
const pageKey = (page: Page) =>
  page.kind === 'routine' ? `routine:${page.name}` : `run:${runKey(page.routine, page.id)}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const actionLines = (content: PageContent) =>
  content.lines.flatMap((line, index) => (line.action ? [index] : []));
const messageContent = (text: string, isError = false): PageContent => ({
  mode: 'scroll',
  lines: [{ line: [{ text, style: isError ? S.red : S.dim }] }],
});

function getAnchor(content: PageContent, line: number, cursor: number): Anchor | null {
  const current = content.lines[line];
  if (content.mode === 'select')
    return current?.action?.kind === 'open-run'
      ? { cursor, key: runKey(current.action.routine, current.action.id), offset: 0 }
      : null;
  if (!current?.itemKey) return null;
  let start = line;
  while (
    start > 0 &&
    content.lines[start]?.isItemStart !== true &&
    content.lines[start - 1]?.itemKey === current.itemKey
  ) {
    start--;
  }
  return { cursor, key: current.itemKey, offset: line - start };
}

function getStep(key: string, height: number): number | null {
  const half = Math.max(1, Math.floor(height / 2));
  const page = Math.max(1, height - 1);
  return match(key)
    .with(P.union('j', 'down'), () => 1)
    .with(P.union('k', 'up'), () => -1)
    .with('C-d', () => half)
    .with('C-u', () => -half)
    .with(P.union('pagedown', 'C-f'), () => page)
    .with(P.union('pageup', 'C-b'), () => -page)
    .with(P.union('g', 'home'), () => -Infinity)
    .with(P.union('G', 'end'), () => Infinity)
    .otherwise(() => null);
}

function tooSmall(width: number, height: number): Line[] {
  const message: Line = [
    {
      text: `terminal too small: need ${MIN_WIDTH}x${MIN_HEIGHT}, have ${width}x${height}`,
      style: S.yellow,
    },
  ];
  return Array.from({ length: height }, (_, row) =>
    fitLine(row === Math.floor(height / 2) ? message : [], width),
  );
}

export interface AppOptions {
  client: DaemonClient;
  now?: () => number;
  onChange?: () => void;
  // Debounces detail loads so holding j does not fetch every run. null leaves loading to the caller.
  pageLoadDelayMs?: number | null;
}

export class TuiApp {
  private readonly client: DaemonClient;
  private readonly now: () => number;
  private readonly onChange: () => void;
  private readonly pageLoadDelayMs: number | null;

  private focus: Focus = 'routines';
  private listFocus: ListFocus = 'routines';
  private cursors: Record<ListFocus, number> = { routines: 0, runs: 0 };
  private selectedKeys: Record<ListFocus, string | null> = { routines: null, runs: null };
  private listScroll: Record<ListFocus, number> = { routines: 0, runs: 0 };
  private listHeights: Record<ListFocus, number> = { routines: 1, runs: 1 };
  private stack: Page[] = [];
  private overlay: Overlay | null = null;
  private message: Message | null = null;

  private overview: Overview | null = null;
  private overviewError: string | null = null;
  private loadedAt: number | null = null;
  private routineDetails = new Map<string, RoutineDetail>();
  private runData = new Map<string, RunData>();
  private pageErrors = new Map<string, string>();
  private refreshing: Promise<void> | null = null;
  private pageLoadTimer: NodeJS.Timeout | null = null;
  private viewport: Viewport | null = null;

  constructor({ client, now = Date.now, onChange = () => {}, pageLoadDelayMs = 120 }: AppOptions) {
    this.client = client;
    this.now = now;
    this.onChange = onChange;
    this.pageLoadDelayMs = pageLoadDelayMs;
  }

  private get routines() {
    return this.overview?.routines ?? [];
  }

  private get runs() {
    return this.overview?.runs ?? [];
  }

  private get page(): Page | undefined {
    return this.stack[this.stack.length - 1];
  }

  hasActiveRuns(): boolean {
    return (
      (this.overview?.status.running ?? 0) > 0 || this.routines.some(routine => routine.running)
    );
  }

  dispose(): void {
    if (this.pageLoadTimer) clearTimeout(this.pageLoadTimer);
  }

  refresh(): Promise<void> {
    this.refreshing ??= this.loadOverview().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async loadOverview(): Promise<void> {
    try {
      this.overview = await this.client.getOverview();
      this.overviewError = null;
      this.loadedAt = this.now();
    } catch (err) {
      this.overviewError = (err as Error).message;
    }
    this.syncSelection();
    this.onChange();
    await this.loadVisiblePage();
  }

  async loadVisiblePage(): Promise<void> {
    const page = this.page;
    if (!page) return;
    const key = pageKey(page);
    try {
      if (page.kind === 'routine') {
        this.routineDetails.set(page.name, await this.client.getRoutine(page.name));
      } else {
        const id = runKey(page.routine, page.id);
        const cached = this.runData.get(id);
        if (cached && cached.run.status !== 'running') return;
        this.storeRun(id, await this.client.getRun(page.routine, page.id), cached);
      }
      this.pageErrors.delete(key);
    } catch (err) {
      this.pageErrors.set(key, (err as Error).message);
    }
    this.onChange();
  }

  private storeRun(
    key: string,
    { run, transcript }: RunWithTranscript,
    previous: RunData | undefined,
  ): void {
    this.runData.delete(key);
    this.runData.set(key, {
      run,
      eventCount: transcript.eventCount,
      items: transcript.items,
      expanded: previous?.expanded ?? new Set(),
      expandedVersion: previous?.expandedVersion ?? 0,
      transcript: previous?.transcript ?? null,
    });
    for (const oldKey of this.runData.keys()) {
      if (this.runData.size <= RUN_CACHE_SIZE) break;
      this.runData.delete(oldKey);
    }
  }

  private requestPageLoad(): void {
    if (this.pageLoadDelayMs === null) return;
    if (this.pageLoadTimer) clearTimeout(this.pageLoadTimer);
    this.pageLoadTimer = setTimeout(() => {
      this.pageLoadTimer = null;
      void this.loadVisiblePage();
    }, this.pageLoadDelayMs);
  }

  private listKeys(list: ListFocus): string[] {
    return list === 'routines'
      ? this.routines.map(routine => routine.name)
      : this.runs.map(run => runKey(run.routine, run.id));
  }

  // Keeps the cursor on the same routine or run when the lists change under it.
  private syncSelection(): void {
    for (const list of ['routines', 'runs'] as const) {
      const keys = this.listKeys(list);
      const selected = this.selectedKeys[list];
      const found = selected === null ? -1 : keys.indexOf(selected);
      this.cursors[list] =
        found === -1 ? clamp(this.cursors[list], 0, Math.max(0, keys.length - 1)) : found;
      this.selectedKeys[list] = keys[this.cursors[list]] ?? null;
    }
    const base = this.basePage();
    if (!base) this.stack = [];
    else if (!this.stack[0] || pageKey(this.stack[0]) !== pageKey(base)) this.stack = [base];
  }

  private basePage(): Page | null {
    if (this.listFocus === 'routines') {
      const routine = this.routines[this.cursors.routines];
      return routine
        ? { kind: 'routine', name: routine.name, tab: 'runs', cursor: 0, scroll: 0, anchor: null }
        : null;
    }
    const run = this.runs[this.cursors.runs];
    return run
      ? {
          kind: 'run',
          routine: run.routine,
          id: run.id,
          cursor: 0,
          scroll: 0,
          anchor: null,
          follow: false,
        }
      : null;
  }

  private resetStack(): void {
    const base = this.basePage();
    this.stack = base ? [base] : [];
    this.requestPageLoad();
  }

  private focusList(list: ListFocus): void {
    this.focus = list;
    if (this.listFocus === list && this.stack.length <= 1) return;
    this.listFocus = list;
    this.resetStack();
  }

  private focusDetail(): void {
    if (this.page) this.focus = 'detail';
  }

  private cycleFocus(direction: 1 | -1): void {
    let index = FOCUS_ORDER.indexOf(this.focus);
    for (let i = 0; i < FOCUS_ORDER.length; i++) {
      index = (index + direction + FOCUS_ORDER.length) % FOCUS_ORDER.length;
      const next = FOCUS_ORDER[index] ?? 'routines';
      if (next !== 'detail') return this.focusList(next);
      if (this.page) return this.focusDetail();
    }
  }

  private back(): void {
    if (this.stack.length > 1) this.stack.pop();
    else this.focus = this.listFocus;
  }

  // A popup only takes keys pressed after it is on screen, so a pasted "ry" can never start a run.
  handleKeys(keys: string[], width: number, height: number): 'quit' | undefined {
    for (const key of keys) {
      const hadOverlay = this.overlay !== null;
      if (this.handleKey(key) === 'quit') return 'quit';
      this.render(width, height);
      if (!hadOverlay && this.overlay) return undefined;
    }
    return undefined;
  }

  handleKey(key: string): 'quit' | undefined {
    if (key === 'C-c') return 'quit';
    if (this.overlay) {
      this.handleOverlayKey(this.overlay, key);
      return undefined;
    }
    if (key === 'q') return 'quit';
    match(key)
      .with('?', () => {
        this.overlay = { kind: 'help' };
      })
      .with('tab', () => this.cycleFocus(1))
      .with('S-tab', () => this.cycleFocus(-1))
      .with('1', () => this.focusList('routines'))
      .with('2', () => this.focusList('runs'))
      .with('0', () => this.focusDetail())
      .with('r', () => this.askToRun())
      .with(P.union('R', 'C-r'), () => void this.refresh())
      .otherwise(() => {
        if (this.focus === 'detail') this.handleDetailKey(key);
        else this.handleListKey(this.focus, key);
      });
    return undefined;
  }

  private handleOverlayKey(overlay: Overlay, key: string): void {
    this.overlay = null;
    if (overlay.kind === 'confirm-run' && key === 'y') void this.startRun(overlay.routine);
  }

  private handleListKey(list: ListFocus, key: string): void {
    if (key === 'enter' || key === 'space' || key === 'l' || key === 'right')
      return this.focusDetail();
    const step = getStep(key, this.listHeights[list]);
    if (step === null) return;
    const keys = this.listKeys(list);
    const next = clamp(this.cursors[list] + step, 0, Math.max(0, keys.length - 1));
    if (next === this.cursors[list]) return;
    this.cursors[list] = next;
    this.selectedKeys[list] = keys[next] ?? null;
    this.resetStack();
  }

  private handleDetailKey(key: string): void {
    const page = this.page;
    if (!page) return;
    if (key === 'escape' || key === 'h' || key === 'left' || key === 'backspace')
      return this.back();
    if (!this.viewport) return;
    const { content, height } = this.viewport;
    if ((key === '[' || key === ']') && page.kind === 'routine')
      return this.switchTab(page, key === ']' ? 1 : -1);
    if (key === 'e' && page.kind === 'run') return this.toggleAll(page);
    if (key === 'enter' || key === 'space' || key === 'l' || key === 'right')
      return this.activate(page, content);
    if ((key === '{' || key === '}') && content.mode === 'line')
      return this.jumpItem(page, content, key === '}' ? 1 : -1);
    const step = getStep(key, height);
    if (step === null) return;
    if (content.mode === 'scroll') {
      page.scroll = clamp(page.scroll + step, 0, Math.max(0, content.lines.length - height));
      return;
    }
    const last =
      (content.mode === 'select' ? actionLines(content).length : content.lines.length) - 1;
    page.cursor = clamp(page.cursor + step, 0, Math.max(0, last));
    if (page.kind === 'run') page.follow = step > 0 && page.cursor === last;
  }

  private switchTab(page: RoutinePage, direction: 1 | -1): void {
    page.tab = TABS[(TABS.indexOf(page.tab) + direction + TABS.length) % TABS.length] ?? 'runs';
    page.cursor = 0;
    page.scroll = 0;
    page.anchor = null;
  }

  private activate(page: Page, content: PageContent): void {
    if (content.mode === 'select') {
      const action = content.lines[actionLines(content)[page.cursor] ?? -1]?.action;
      if (action?.kind !== 'open-run') return;
      this.stack.push({
        kind: 'run',
        routine: action.routine,
        id: action.id,
        cursor: 0,
        scroll: 0,
        anchor: null,
        follow: false,
      });
      this.requestPageLoad();
      return;
    }
    const action = content.lines[page.cursor]?.action;
    if (page.kind !== 'run' || action?.kind !== 'toggle') return;
    const data = this.runData.get(runKey(page.routine, page.id));
    if (!data) return;
    const isExpanding = !data.expanded.has(action.key);
    if (isExpanding) data.expanded.add(action.key);
    else data.expanded.delete(action.key);
    data.expandedVersion++;
    const updated = this.moveCursorToItem(page, action.key);
    if (isExpanding && updated && this.viewport)
      this.revealItem(page, updated, action.key, this.viewport.height);
  }

  private revealItem(page: RunPage, content: PageContent, itemKey: string, height: number): void {
    let end = page.cursor;
    while (
      content.lines[end + 1]?.itemKey === itemKey &&
      content.lines[end + 1]?.isItemStart !== true
    ) {
      end++;
    }
    page.scroll = Math.max(page.scroll, Math.min(page.cursor, end - height + 1));
  }

  private toggleAll(page: RunPage): void {
    const data = this.runData.get(runKey(page.routine, page.id));
    if (!data) return;
    const keys = data.items.filter(isExpandable).map(item => item.key);
    const shouldExpand = keys.some(key => !data.expanded.has(key));
    data.expanded = new Set(shouldExpand ? keys : []);
    data.expandedVersion++;
    this.moveCursorToItem(page, this.viewport?.content.lines[page.cursor]?.itemKey);
  }

  private moveCursorToItem(page: RunPage, itemKey: string | undefined): PageContent | null {
    if (!this.viewport || !itemKey) return null;
    const content = this.buildPageContent(page, this.viewport.width, this.now());
    const index = content.lines.findIndex(line => line.isItemStart && line.itemKey === itemKey);
    if (index !== -1) page.cursor = index;
    page.follow = false;
    page.anchor = null;
    return content;
  }

  private jumpItem(page: Page, content: PageContent, direction: 1 | -1): void {
    for (let i = page.cursor + direction; i >= 0 && i < content.lines.length; i += direction) {
      if (content.lines[i]?.isItemStart !== true) continue;
      page.cursor = i;
      if (page.kind === 'run') page.follow = false;
      return;
    }
  }

  private contextRoutine(): string | null {
    if (this.focus === 'routines') return this.routines[this.cursors.routines]?.name ?? null;
    if (this.focus === 'runs') return this.runs[this.cursors.runs]?.routine ?? null;
    const page = this.page;
    if (!page) return null;
    return page.kind === 'routine' ? page.name : page.routine;
  }

  private askToRun(): void {
    const name = this.contextRoutine();
    if (!name) return;
    if (this.routines.find(routine => routine.name === name)?.running)
      return this.flash(`${name} is already running`, 'error');
    this.overlay = { kind: 'confirm-run', routine: name };
  }

  private async startRun(name: string): Promise<void> {
    try {
      await this.client.startRun(name);
      this.flash(`started ${name}`, 'ok');
    } catch (err) {
      this.flash((err as Error).message, 'error');
    }
    await this.refreshing;
    await this.refresh();
  }

  private flash(text: string, tone: Message['tone']): void {
    this.message = { text, tone, at: this.now() };
    this.onChange();
  }

  render(width: number, height: number): Line[] {
    if (width < MIN_WIDTH || height < MIN_HEIGHT) return tooSmall(width, height);
    const now = this.now();
    const leftWidth = clamp(Math.round(width * 0.36), 34, 56);
    const bodyHeight = height - 1;
    const statusHeight = 4;
    const listsHeight = bodyHeight - statusHeight;
    const routinesHeight = clamp(this.routines.length + 2, 4, Math.floor(listsHeight * 0.6));
    const left = [
      ...box({
        title: 'Papa Carlo',
        width: leftWidth,
        height: statusHeight,
        body: statusLines(this.overview, this.overviewError, this.loadedAt, now),
        isFocused: false,
      }),
      ...this.renderList(
        'routines',
        '[1] Routines',
        this.routines.map(routine => routineRow(routine, leftWidth - 4, now)),
        leftWidth,
        routinesHeight,
      ),
      ...this.renderList(
        'runs',
        '[2] Recent runs',
        this.runs.map(run => runRow(run, leftWidth - 4, now)),
        leftWidth,
        listsHeight - routinesHeight,
      ),
    ];
    const right = this.renderDetail(width - leftWidth, bodyHeight, now);
    const frame = left.map((line, index) => [...line, ...(right[index] ?? [])]);
    frame.push(hintsBar(this.hints(), this.statusRight(now), width));
    if (!this.overlay) return frame;
    const popup = match(this.overlay)
      .with({ kind: 'help' }, () => helpPopup(width, height))
      .with({ kind: 'confirm-run' }, ({ routine }) => confirmPopup(routine, width))
      .exhaustive();
    return overlayOnto(frame, popup, width);
  }

  private renderList(
    list: ListFocus,
    title: string,
    rows: Line[],
    width: number,
    height: number,
  ): Line[] {
    const visible = Math.max(1, height - 2);
    this.listHeights[list] = visible;
    const cursor = this.cursors[list];
    const scroll = clamp(this.listScroll[list], Math.max(0, cursor - visible + 1), cursor);
    this.listScroll[list] = scroll;
    if (rows.length === 0) {
      const empty = this.overview ? 'nothing here yet' : this.overviewError ? '' : 'loading…';
      return box({
        title,
        width,
        height,
        body: [[{ text: empty, style: S.dim }]],
        isFocused: this.focus === list,
      });
    }
    return box({
      title,
      width,
      height,
      body: rows.slice(scroll, scroll + visible),
      isFocused: this.focus === list,
      footer: `${cursor + 1} of ${rows.length}`,
      highlightRow: cursor - scroll,
    });
  }

  private renderDetail(width: number, height: number, now: number): Line[] {
    const page = this.page;
    const isFocused = this.focus === 'detail';
    if (!page) {
      this.viewport = null;
      return box({ title: '[0] Detail', width, height, body: [], isFocused });
    }
    const contentWidth = width - 4;
    const visible = height - 2;
    const content = this.buildPageContent(page, contentWidth, now);
    this.clampPage(page, content, visible, isFocused);
    this.viewport = { content, height: visible, width: contentWidth };
    const cursorLine = isFocused
      ? match(content.mode)
          .with('scroll', () => null)
          .with('select', () => actionLines(content)[page.cursor] ?? null)
          .with('line', () => page.cursor)
          .exhaustive()
      : null;
    const body = content.lines.slice(page.scroll, page.scroll + visible).map(({ line }) => line);
    const isFollowing =
      page.kind === 'run' &&
      page.follow &&
      this.runData.get(runKey(page.routine, page.id))?.run.status === 'running';
    const percent =
      content.lines.length > visible
        ? `${Math.round((100 * Math.min(content.lines.length, page.scroll + visible)) / content.lines.length)}%`
        : '';
    const footer = [isFollowing ? 'following' : '', percent].filter(Boolean).join(' · ');
    return box({
      title: page.kind === 'routine' ? `[0] ${page.name}` : `[0] ${page.routine} › ${page.id}`,
      width,
      height,
      body,
      isFocused,
      footer: footer || undefined,
      highlightRow: cursorLine === null ? null : cursorLine - page.scroll,
    });
  }

  private buildPageContent(page: Page, width: number, now: number): PageContent {
    const error = this.pageErrors.get(pageKey(page));
    if (page.kind === 'routine') {
      const summary =
        this.routines.find(routine => routine.name === page.name) ??
        this.routineDetails.get(page.name);
      if (!summary) return messageContent(error ?? `Unknown routine ${page.name}`, true);
      return routinePage({
        summary,
        detail: this.routineDetails.get(page.name),
        tab: page.tab,
        width,
        now,
        error,
      });
    }
    const data = this.runData.get(runKey(page.routine, page.id));
    if (!data) return messageContent(error ?? 'loading…', Boolean(error));
    const isRunning = data.run.status === 'running';
    const cacheKey = `${width}|${data.eventCount}|${data.expandedVersion}|${isRunning}`;
    if (data.transcript?.key !== cacheKey) {
      data.transcript = {
        key: cacheKey,
        lines: transcriptLines(data.items, data.eventCount, data.expanded, width, isRunning),
      };
    }
    const init = data.items.find(item => item.kind === 'init');
    return {
      mode: 'line',
      lines: [
        ...runHeaderLines(data.run, init?.kind === 'init' ? init.cwd : null, width, now),
        ...data.transcript.lines,
      ],
    };
  }

  private clampPage(page: Page, content: PageContent, height: number, isFocused: boolean): void {
    const maxScroll = Math.max(0, content.lines.length - height);
    if (content.mode === 'scroll') {
      page.scroll = clamp(page.scroll, 0, maxScroll);
      return;
    }
    const targets = content.mode === 'select' ? actionLines(content) : null;
    const last = (targets ? targets.length : content.lines.length) - 1;
    if (page.kind === 'run' && page.follow) page.cursor = last;
    else if (isFocused) this.restoreAnchor(page, content, targets);
    page.cursor = clamp(page.cursor, 0, Math.max(0, last));
    const line = targets ? targets[page.cursor] : page.cursor;
    if (line === undefined) {
      page.scroll = clamp(page.scroll, 0, maxScroll);
      page.anchor = null;
      return;
    }
    // On the first row of a list, scroll all the way up so the page header stays visible.
    if (page.cursor === 0) page.scroll = 0;
    page.scroll = clamp(page.scroll, Math.max(0, line - height + 1), Math.min(line, maxScroll));
    page.anchor = isFocused ? getAnchor(content, line, page.cursor) : null;
  }

  // Only when the cursor did not move since the last render, otherwise the key that moved it wins.
  private restoreAnchor(page: Page, content: PageContent, targets: number[] | null): void {
    const anchor = page.anchor;
    if (!anchor || anchor.cursor !== page.cursor) return;
    if (targets) {
      const index = targets.findIndex(line => getAnchor(content, line, 0)?.key === anchor.key);
      if (index !== -1) page.cursor = index;
      return;
    }
    const start = content.lines.findIndex(line => line.isItemStart && line.itemKey === anchor.key);
    if (start === -1) return;
    const shift = start + anchor.offset - page.cursor;
    page.cursor += shift;
    page.scroll += shift;
  }

  private hints(): Hint[] {
    const tail: Hint[] = [
      ['?', 'help'],
      ['q', 'quit'],
    ];
    const page = this.page;
    if (this.focus !== 'detail') {
      return [
        ['↑↓', 'move'],
        ['enter', 'open'],
        ['r', this.focus === 'runs' ? 'run again' : 'run now'],
        ['tab', 'panels'],
        ['R', 'refresh'],
        ...tail,
      ];
    }
    if (page?.kind === 'run') {
      return [
        ['↑↓', 'move'],
        ['enter', 'expand'],
        ['e', 'expand all'],
        ['{ }', 'items'],
        ['G', 'follow'],
        ['esc', 'back'],
        ['r', 'run now'],
        ...tail,
      ];
    }
    const isRunsTab = page?.tab === 'runs';
    return [
      ['↑↓', isRunsTab ? 'move' : 'scroll'],
      ...(isRunsTab ? ([['enter', 'open run']] as Hint[]) : []),
      ['[ ]', 'tabs'],
      ['esc', 'back'],
      ['r', 'run now'],
      ...tail,
    ];
  }

  private statusRight(now: number): Line {
    if (this.message && now - this.message.at < MESSAGE_MS)
      return [
        { text: this.message.text, style: this.message.tone === 'ok' ? S.boldGreen : S.boldRed },
      ];
    if (this.overviewError) return [{ text: this.overviewError, style: S.red }];
    if (this.loadedAt === null) return [];
    return [
      {
        text: `updated ${formatRelative(new Date(this.loadedAt).toISOString(), now)}`,
        style: S.dim,
      },
    ];
  }
}
