import { useState } from 'react';
import { Check, ChevronDown, Workflow } from 'lucide-react';
import { Button, Command, Popover } from 'design-system/components';
import { cn } from 'design-system/utils';
import type { RoutineName } from 'domains/routine/ids';
import type { RoutineSummary } from 'domains/routine/types';
import { checkMatchesSearch } from 'utils/search';

interface RoutinePickerProps {
  routines: RoutineSummary[];
  value: RoutineName | null;
  onChange: (name: RoutineName) => void;
}

export function RoutinePicker({ routines, value, onChange }: RoutinePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const foundRoutines = routines.filter(routine =>
    checkMatchesSearch(search, [routine.name, routine.description, routine.agent, routine.cwd]),
  );

  function toggle(isOpening: boolean) {
    setIsOpen(isOpening);
    if (isOpening) setSearch('');
  }

  function choose(name: RoutineName) {
    onChange(name);
    toggle(false);
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={toggle}>
      <Popover.Trigger asChild>
        {/* A 44px tap area on phones that keeps the row above the prompt as short as on desktop. */}
        <Button
          type="button"
          variant="secondary"
          size="small"
          aria-label={value === null ? 'Choose a routine' : `Routine ${value}`}
          className="relative max-w-full min-w-0 shrink-0 max-sm:after:absolute max-sm:after:-inset-2"
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
              {routines.length === 0 ? 'No routines yet' : 'No routines match'}
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
