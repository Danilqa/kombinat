import { Settings } from 'lucide-react';

import { Button, DropdownMenu } from 'design-system';
import { RUN_RETENTION_DAYS_OPTIONS } from 'domains/settings/constants';
import { getRunRetentionLabel } from 'domains/settings/utils';
import { useSettings, useUpdateRunRetention } from '../queries';

const toOptionValue = (days: number | null): string => (days === null ? 'forever' : String(days));

export function RunRetentionMenu() {
  const { data } = useSettings();
  const { mutate, error } = useUpdateRunRetention();

  function changeRetention(value: string) {
    const days = RUN_RETENTION_DAYS_OPTIONS.find(option => toOptionValue(option) === value);
    if (days !== undefined) mutate(days);
  }

  return (
    <>
      {error && (
        <span
          role="alert"
          className="max-w-56 animate-in truncate text-body-sm text-negative duration-200 fade-in"
          title={error.message}
        >
          {error.message}
        </span>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="tertiary" size="icon-small" className="tap-area" aria-label="Settings">
            <Settings className="transition-transform duration-300 ease-out-quint group-data-[state=open]/button:rotate-45" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="w-56">
          <DropdownMenu.Label>Keep runs for</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={data ? toOptionValue(data.runRetentionDays) : ''}
            onValueChange={changeRetention}
          >
            {RUN_RETENTION_DAYS_OPTIONS.map(days => (
              <DropdownMenu.RadioItem key={toOptionValue(days)} value={toOptionValue(days)}>
                {getRunRetentionLabel(days)}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <p className="px-2.5 pt-1 pb-1.5 text-caption font-normal text-fg-muted">
            Older runs and webhook calls are deleted right away, except the last run of each
            routine.
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  );
}
