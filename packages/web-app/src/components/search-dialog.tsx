import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Loader, Play, Search, Workflow } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Command, Kbd } from 'design-system/components';
import { useDebouncedValue } from 'design-system/utils';
import { QUERY_KEYS_CHANGED_BY_RUN } from 'domains/routine/constants';
import type { RoutineName } from 'domains/routine/ids';
import { getRoutines, startRoutineRun } from 'domains/routine/requests';
import type { RoutineSummary } from 'domains/routine/types';
import { RunStatusBadge } from 'domains/run/components';
import { searchRuns } from 'domains/run/requests';
import type { RunRecord } from 'domains/run/types';
import { formatRelativeCompact } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';
import { checkMatchesSearch, getSearchExcerpt } from 'utils/search';
import { navItems, type NavItem } from '@web-app/constants/nav-items';
import { getRoutinePath, getRunPath } from '@web-app/constants/path';

const RUNS_SEARCH_DELAY_MS = 150;
const RECENT_RUNS_COUNT = 5;
const FOUND_RUNS_COUNT = 20;

function checkRoutineMatches(routine: RoutineSummary, search: string): boolean {
  return checkMatchesSearch(search, [
    routine.name,
    routine.description,
    routine.agent,
    routine.model,
    routine.scheduleHuman,
  ]);
}

function toRoutineValue(routine: RoutineSummary): string {
  return `routine:${routine.name}`;
}

function toRunValue(run: RunRecord): string {
  return `run:${run.routine}/${run.id}`;
}

function toRunNowValue(routine: RoutineSummary): string {
  return `run-now:${routine.name}`;
}

function toPageValue(item: NavItem): string {
  return `page:${item.to}`;
}

function getRunExcerpt(run: RunRecord, search: string): string | null {
  if (search === '') return null;
  return (
    getSearchExcerpt(run.resultText ?? '', search) ?? getSearchExcerpt(run.error ?? '', search)
  );
}

interface RoutineItemProps {
  routine: RoutineSummary;
  onSelect: () => void;
}

function RoutineItem({ routine, onSelect }: RoutineItemProps) {
  return (
    <Command.Item value={toRoutineValue(routine)} onSelect={onSelect}>
      <Workflow aria-hidden="true" />
      <span className="max-w-1/2 truncate font-medium text-fg">{routine.name}</span>
      <span className="min-w-0 flex-1 truncate text-fg-muted">{routine.description}</span>
      {!routine.enabled && (
        <Badge size="small" variant="ghost">
          Disabled
        </Badge>
      )}
      <Badge size="small" className="max-w-40 max-sm:hidden">
        <span className="truncate">{routine.scheduleHuman}</span>
      </Badge>
    </Command.Item>
  );
}

interface RunItemProps {
  run: RunRecord;
  excerpt: string | null;
  onSelect: () => void;
}

function RunItem({ run, excerpt, onSelect }: RunItemProps) {
  return (
    <Command.Item value={toRunValue(run)} onSelect={onSelect}>
      <History aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="max-w-3/5 shrink-0 truncate font-medium text-fg">{run.routine}</span>
          <span className="min-w-0 truncate font-mono text-body-sm text-fg-muted max-sm:hidden">
            {run.id}
          </span>
        </span>
        {excerpt !== null && (
          <span className="block truncate text-body-sm text-fg-muted">{excerpt}</span>
        )}
      </span>
      <span className="shrink-0 text-body-sm text-fg-muted tabular-nums max-sm:hidden">
        {formatRelativeCompact(run.startedAt)}
      </span>
      <RunStatusBadge status={run.status} />
    </Command.Item>
  );
}

interface RunNowItemProps {
  routine: RoutineSummary;
  isStarting: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}

function RunNowItem({ routine, isStarting, isDisabled, onSelect }: RunNowItemProps) {
  return (
    <Command.Item
      value={toRunNowValue(routine)}
      disabled={isDisabled || routine.running}
      onSelect={onSelect}
    >
      {isStarting ? (
        <Loader aria-hidden="true" className="spin-in-place" />
      ) : (
        <Play aria-hidden="true" className="fill-current" />
      )}
      <span className="min-w-0 flex-1 truncate text-fg">
        Run <span className="font-medium">{routine.name}</span> now
      </span>
      {routine.running && <span className="text-body-sm text-fg-muted">Running</span>}
    </Command.Item>
  );
}

interface SearchPanelProps {
  onClose: () => void;
}

function SearchPanel({ onClose }: SearchPanelProps) {
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const [highlightedFirst, setHighlightedFirst] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const trimmedSearch = search.trim();
  const runsSearch = useDebouncedValue(trimmedSearch, RUNS_SEARCH_DELAY_MS);
  const routines = useQuery({
    queryKey: ['routines'],
    queryFn: () => getRoutines(sameOriginApi),
  });
  const runs = useQuery({
    queryKey: ['runs', { search: runsSearch }],
    queryFn: () => searchRuns(sameOriginApi, runsSearch),
    placeholderData: keepPreviousData,
  });
  const startRun = useMutation({
    mutationFn: (routine: RoutineName) => startRoutineRun(sameOriginApi, routine),
    onSuccess: (_, routine) => {
      for (const queryKey of QUERY_KEYS_CHANGED_BY_RUN) {
        void queryClient.invalidateQueries({ queryKey });
      }
      openPage(getRoutinePath(routine));
    },
  });

  function openPage(path: string) {
    onClose();
    void navigate(path);
  }

  const isSearching = trimmedSearch !== '';
  const isLoadingRuns = runs.isFetching || runsSearch !== trimmedSearch;
  const allRoutines = routines.data ?? [];
  const foundRoutines = allRoutines.filter(routine => checkRoutineMatches(routine, trimmedSearch));
  const runNowRoutines = isSearching
    ? allRoutines.filter(routine => checkMatchesSearch(trimmedSearch, ['Run now', routine.name]))
    : [];
  const foundRuns =
    runs.data?.runs.slice(0, isSearching ? FOUND_RUNS_COUNT : RECENT_RUNS_COUNT) ?? [];
  const pages = navItems.filter(item => checkMatchesSearch(trimmedSearch, [item.label]));
  const error = routines.error ?? runs.error ?? startRun.error;
  const routineAndRunValues = isSearching
    ? [...foundRoutines.map(toRoutineValue), ...foundRuns.map(toRunValue)]
    : [...foundRuns.map(toRunValue), ...foundRoutines.map(toRoutineValue)];
  const firstValue =
    [...routineAndRunValues, ...runNowRoutines.map(toRunNowValue), ...pages.map(toPageValue)][0] ??
    '';
  // Runs load after routines, so the first result can change after cmdk has highlighted one.
  if (firstValue !== highlightedFirst) {
    setHighlightedFirst(firstValue);
    setHighlighted(firstValue);
  }
  const runsGroup = foundRuns.length > 0 && (
    <Command.Group heading={isSearching ? 'Runs' : 'Recent runs'}>
      {foundRuns.map(run => (
        <RunItem
          key={`${run.routine}/${run.id}`}
          run={run}
          excerpt={getRunExcerpt(run, runsSearch)}
          onSelect={() => openPage(getRunPath(run.routine, run.id))}
        />
      ))}
    </Command.Group>
  );

  return (
    <Command.Root
      label="Search"
      shouldFilter={false}
      loop
      value={highlighted}
      onValueChange={setHighlighted}
    >
      <Command.Header>
        <Badge size="small">
          <Search aria-hidden="true" />
          Search
        </Badge>
        <span className="flex items-center gap-1.5 text-body-sm text-fg-muted max-sm:hidden">
          <Kbd>↵</Kbd> to open, <Kbd>esc</Kbd> to close
        </span>
      </Command.Header>
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Search routines, runs and pages"
      />
      <Command.List>
        {error && (
          <p role="alert" className="px-2.5 py-2 text-body text-negative">
            {error.message}
          </p>
        )}
        {isLoadingRuns ? (
          foundRuns.length === 0 && <Command.Loading>Searching runs…</Command.Loading>
        ) : (
          <Command.Empty>No results for “{trimmedSearch}”</Command.Empty>
        )}
        {!isSearching && runsGroup}
        {foundRoutines.length > 0 && (
          <Command.Group heading="Routines">
            {foundRoutines.map(routine => (
              <RoutineItem
                key={routine.name}
                routine={routine}
                onSelect={() => openPage(getRoutinePath(routine.name))}
              />
            ))}
          </Command.Group>
        )}
        {isSearching && runsGroup}
        {runNowRoutines.length > 0 && (
          <Command.Group heading="Actions">
            {runNowRoutines.map(routine => (
              <RunNowItem
                key={routine.name}
                routine={routine}
                isStarting={startRun.isPending && startRun.variables === routine.name}
                isDisabled={startRun.isPending}
                onSelect={() => startRun.mutate(routine.name)}
              />
            ))}
          </Command.Group>
        )}
        {pages.length > 0 && (
          <Command.Group heading="Pages">
            {pages.map(item => (
              <Command.Item
                key={item.to}
                value={toPageValue(item)}
                onSelect={() => openPage(item.to)}
              >
                <item.icon aria-hidden="true" />
                <span className="text-fg">{item.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Root>
  );
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} title="Search">
      <SearchPanel onClose={() => onOpenChange(false)} />
    </Command.Dialog>
  );
}
