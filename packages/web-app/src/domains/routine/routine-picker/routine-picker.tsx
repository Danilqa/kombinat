import { useState } from 'react';
import { Check, ChevronDown, Workflow } from 'lucide-react';
import { Button, Command, Popover, cn } from 'design-system';
import type { RoutineName } from 'domains/routine/ids';
import type { RoutineSummary } from 'domains/routine/types';
import { checkMatchesSearch } from 'utils/search';

interface RoutinePickerProps {
  routines: RoutineSummary[];
  value: RoutineName | null;
  onChange: (name: RoutineName) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function RoutinePicker({
  routines,
  value,
  onChange,
  isOpen,
  onOpenChange,
}: RoutinePickerProps) {
  const [search, setSearch] = useState('');
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setSearch('');
  }
  const foundRoutines = routines.filter(routine =>
    checkMatchesSearch(search, [routine.name, routine.description, routine.agent, routine.cwd]),
  );

  function choose(name: RoutineName) {
    onChange(name);
    onOpenChange(false);
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="small"
          aria-label={value === null ? 'Choose a routine' : `Routine ${value}`}
          className="tap-area max-w-full min-w-0 shrink-0"
        >
          <Workflow aria-hidden="true" className="text-fg-muted" />
          <span className={cn('truncate', value === null && 'text-fg-secondary')}>
            {value ?? 'Choose a routine'}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="text-fg-muted transition-transform duration-200 ease-out-quint group-data-[state=open]/button:rotate-180"
          />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align="start"
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-1.5rem)] p-0"
      >
        <Command.Root shouldFilter={false}>
          <Command.Input
            aria-label="Search routines"
            placeholder="Search routines"
            value={search}
            onValueChange={setSearch}
            className="h-10 px-3 text-body"
          />
          <Command.List className="max-h-[min(20rem,50vh)]">
            <Command.Empty className="py-6">
              {routines.length === 0 ? (
                <>
                  No routines yet. Add a markdown file to{' '}
                  <code className="font-mono">routines/</code> to create one.
                </>
              ) : (
                'No routines match'
              )}
            </Command.Empty>
            {foundRoutines.map(routine => (
              <Command.Item
                key={routine.name}
                value={routine.name}
                onSelect={() => choose(routine.name)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{routine.name}</span>
                  {routine.description !== '' && (
                    <span className="block truncate text-body-sm text-fg-muted">
                      {routine.description}
                    </span>
                  )}
                </span>
                {routine.running && <span className="text-body-sm text-fg-muted">Running</span>}
                <Check aria-hidden="true" className={cn(routine.name !== value && 'invisible')} />
              </Command.Item>
            ))}
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  );
}
